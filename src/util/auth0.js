import { promisify } from "es6-promisify";
import Auth0 from "auth0-js";
import { apiRequest, CustomError } from "./util.js";
import { getUser } from "pages/api/_db.js";
import { Auth0Client } from '@auth0/auth0-spa-js';

// Initialize Auth0
const auth0Realm = "Username-Password-Authentication";
const auth0 = new Auth0.WebAuth({
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  clientID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  audience: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/`,
  responseType: "code",
  scope: "openid email profile offline_access",

});

// First let's create promisified versions of the Auth0 methods we need
// so that we can use then().catch() instead of dealing with callback hell.
// We use bind so that internally "this" still has the correct scope.

const signupAndAuthorize = promisify(auth0.signupAndAuthorize.bind(auth0));
const login = promisify(auth0.client.login.bind(auth0.client));
const popupAuthorize = promisify(auth0.popup.authorize.bind(auth0.popup));
const userInfo = promisify(auth0.client.userInfo.bind(auth0.client));
const changePassword = promisify(auth0.changePassword.bind(auth0));
const signupwithpasswordless = promisify(auth0.passwordlessStart.bind(auth0));

// Now lets wrap our methods with extra logic, such as including a "connection" value
// and ensuring human readable errors are thrown for our UI to catch and display.
// We make these custom methods available within an auth0.extended object.

let onChangeCallback = () => null;

auth0.extended = {
  getCurrentUser: () => {

    const accessToken = getAccessToken();
    return userInfo(accessToken).catch(handleError);
  },

  signupAndAuthorize: (options) => {
    return signupAndAuthorize({
      connection: auth0Realm,
      ...options,
    })
      .then(handleAuth)
      .catch(handleError);
  },

  signupwithpasswordless: (options) => {
    return signupwithpasswordless({
      connection: "email",
      send: "link",
      ...options
    })
      .then(handlePasswordlessUser)
      .catch(handleError);
  },

  login: (options) => {
    return login({
      realm: auth0Realm,
      ...options,
    })
      .then(handleAuth)
      .catch(handleError);
  },

  popupAuthorize: async (options) => {
    console.log("popup authorize ", options);
    return popupAuthorize({
      ...options, redirectUri: 'http://localhost:3000/auth0-callback'
    }).then(handleAuth).catch(handleError);
  },

  // Send email so user can reset password
  changePassword: (options) => {
    return changePassword({
      connection: auth0Realm,
      ...options,
    }).catch((error) => handleError(error, true));
  },

  updateEmail: (email) => {
    return apiRequest("auth-user", "PATCH", { email });
  },

  // Update password of authenticated user
  updatePassword: (password) => {
    return apiRequest("auth-user", "PATCH", { password });
  },

  updateProfile: (data) => {
    return apiRequest("auth-user", "PATCH", data);
  },

  logout: () => {
    handleLogout();
  },

  // parseHashFromUrl: () => {
  //   // console.log("authresult",authResult)
  //   auth0.parseHash((err, authResult) => {
  //     if (authResult && authResult.accessToken && authResult.idToken) {
  //       setAccessToken(authResult.accessToken);
  //       setUid(authResult.idTokenPayload.sub);
  //     } else if (err) {
  //       console.error(err);
  //     }
  //   });
  //   return true;
  // },
  //linking user identifier
  linkAccount: async () => {
    const accessToken = getAccessToken();
    const userDetails = await userInfo(accessToken);
    const { sub } = userDetails;
    const a0 = await new Auth0Client({
      domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
      client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
    });
    await a0.loginWithPopup({
      max_age: 0,
      scope: "openid",
    });
    console.log(a0);
    const { __raw: targetUserIdToken } = await a0.getIdTokenClaims();
    return await new Auth0.Management({
      domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
      clientID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID
    }).linkUser(sub, targetUserIdToken)

    /* return await fetch(
      `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${sub}/identities`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body:JSON.stringify({
          link_with: targetUserIdToken,
        }) ,
      }
    ).then(async result=>{
      let newval=await result.json()
      return newval;
    }) */

  },
  //unlinking user identifier
  unlinkAccount: async (providerSecondary, idSecondary) => {
    const accessToken = getAccessToken();
    const userDetails = await userInfo(accessToken);
    const { sub } = userDetails;
    console.log(userDetails)
    const result = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${sub}/identities/${providerSecondary}/${idSecondary}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
    return result
  },
  //enlisting identifiers
  linkedAccountList: async () => {
    const accessToken = getAccessToken();
    const userDetails = await userInfo(accessToken);
    const { email } = userDetails;
    let result = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users?q=${encodeURIComponent(`email:"${email}"`)}&search_engine=v3`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_MANGEMENT_TOKEN}`
      }
    })
    let finalIds = await result.json()
    return await finalIds
  },
  // A method for listening to to auth changes and receiving user data in passed callback
  onChange: function (cb) {
    // Store passed callback function
    onChangeCallback = cb;

    const handleOnChange = (data, key) => {

      if (key === TOKEN_STORAGE_KEY && data) {
        userInfo(data)
          .then((user) => {
            onChangeCallback(user);
          })
          .catch((error) => handleError(error, true));
      }
      //using uid if no access token
      else if (key === UID_STORAGE_KEY && data) {
        getUser(data)
          .then((user) => {
            user.sub = user.uid;
            onChangeCallback(user);
          })
          .catch((error) => handleError(error, true));
      } else {
        onChangeCallback(false);
      }
    };

    // Local Storage listener
    // This is ONLY called when storage is changed by another tab so we
    // must manually call onChangeCallback after any user triggered changes.
    const listener = window.addEventListener(
      "storage",
      ({ key, newValue }) => {
        if (key === TOKEN_STORAGE_KEY) {
          handleOnChange(newValue, key);
        }
        // if token not present, check for uid for possibility of passwordless user
        else if (key === UID_STORAGE_KEY) {
          handleOnChange(newValue, key);
        }
      },
      false
    );

    // Get accessToken from storage and call handleOnChange.
    const accessToken = getAccessToken();
    if (accessToken == null) {
      const uid = getUid();
      handleOnChange(uid, UID_STORAGE_KEY)
    }
    else {
      handleOnChange(accessToken, TOKEN_STORAGE_KEY);
    }


    // Return an unsubscribe function so calling function can
    // call unsubscribe when needed (such as when a component unmounts).
    return () => {
      window.removeEventListener("storage", listener);
    };
  },

  getAccessToken: () => getAccessToken(),
  getUid: () => getUid(),
  setTokens: async (token) => {
    await setAccessToken(token.access_token)
    await setRefreshToken(token.refresh_token)
  }

};

// Gets passed auth response, stores accessToken, returns user data.
const handleAuth = (response) => {
  console.log({ response, code: response.code });
  setAccessToken(response.accessToken);
  return userInfo(response.accessToken).then((user) => {
    setUid(user.sub);
    onChangeCallback(user);
    return user;
  });
};

const handlePasswordlessUser = (response) => {
  const user = {
    email: response.email,
    email_verified: response.emailVerified,
    sub: "email|" + response.Id,
    uid: "email|" + response.Id,
  }
  setUid(user.uid);
  onChangeCallback(user);
  return user;
}

const handleLogout = () => {
  removeAccessToken();
  removeUid();
  onChangeCallback(false);
};

const handleError = (error, autoLogout = false) => {
  console.log("popo up authorize error", error, autoLogout);

  // If error code indicates user is unauthorized then log them out.
  // We only do this if autoLogout is enabled so we can skip in instances
  // where it's not possible its due to token expiration (such as right after login)
  // and we'd rather throw an error that can be displayed by the UI.
  if (error.code === 401 && autoLogout) {
    handleLogout();
  }

  // Find a human readable error message in an Auth0 error object and throw.
  // Unfortunately, it's not always in the same location :/
  let message;
  if (error.code === "invalid_password") {
    message = `Your password must be: ${error.policy}`;
  } else if (typeof error.message === "string") {
    message = error.message;
  } else if (typeof error.description === "string") {
    message = error.description;
  } else if (typeof error.original === "string") {
    message = error.original;
  } else if (error.original && typeof error.original.message === "string") {
    message = error.original.message;
  } else {
    message = error.code; // Use error.code if no better option
  }

  throw new CustomError(error.code, message);
};

// Local Storage methods
const TOKEN_STORAGE_KEY = "auth0_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "auth0_refresh_token";
const UID_STORAGE_KEY = "auth0_uid";
const getAccessToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
const setAccessToken = (accessToken) =>
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
const setRefreshToken = (accessToken) =>
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, accessToken);
const getUid = () => localStorage.getItem(UID_STORAGE_KEY);
const setUid = (uid) =>
  localStorage.setItem(UID_STORAGE_KEY, uid);
const removeAccessToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);
const removeUid = () => localStorage.removeItem(UID_STORAGE_KEY);

export default auth0;
