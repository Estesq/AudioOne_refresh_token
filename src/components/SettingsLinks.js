import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { useAuth } from "util/auth.js";
import { useForm } from "react-hook-form";
import { linkAccountDb, unlinkAccountDb } from "util/db";

function SettingsLinks(props) {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  const [pendingIds, setPendingIds] = useState(false);
  const [identities, setIdentities] = useState()
  const handleData = async () => {
    await setIdentities({ finalIds: await auth.linkedAccountList() })
  }
  useEffect(() => {
    handleData()
  }, [pending, pendingIds])
  const providerList = {
    "google-oauth2": "Google",
    "facebook": "Facebook",
    "twitter": "Twitter"
  }

  const handleClick = () => {
    // Show pending indicator
    setPending(true);

    return auth
      .linkAccount()
      .then((result) => {
        linkAccountDb(`${result[0].provider}|${result[0].user_id}`, `${result[result.length - 1].provider}|${result[result.length - 1].user_id}`)
        // Set success status
        props.onStatus({
          type: "success",
          message: "New account has been Added",
        });
      })
      .catch((error) => {
        if (error.code === "auth/requires-recent-login") {
          props.onStatus({
            type: "requires-recent-login",
            // Resubmit after reauth flow
            callback: () => onSubmit(data),
          });
        } else {
          // Set error status
          props.onStatus({
            type: "error",
            message: error.message,
          });
        }
      })
      .finally(() => {
        // Hide pending indicator
        setPending(false);
      });
  };


  const handleRemove = (provider, uid) => {
    setPendingIds(true)
    auth.unlinkAccount(provider, uid).then(async (result1) => {
      let result = await result1.json()
      unlinkAccountDb(`${result[0].provider}|${result[0].user_id}`, `${provider}|${uid}`)

      // Set success status
      props.onStatus({
        type: "success",
        message: "Account Removed...",
      });
    }).catch((error) => {
      props.onStatus({
        type: "error",
        message: error.message,
      });
    })
      .finally(() => {
        // Hide pending indicator
        setPendingIds(false);
      });
  }
  return (
    <>
      <Button onClick={handleClick} size="lg" disabled={pending}>
        <span>Link new account</span>

        {pending && (
          <Spinner
            animation="border"
            size="sm"
            role="status"
            aria-hidden={true}
            className="ml-2 align-baseline"
          >
            <span className="sr-only">Linking...</span>
          </Spinner>

        )}

      </Button>

      <h1>Linked Accounts</h1>
      {identities ? identities.finalIds[0].identities.map((el, index) =>
        <div key={index} style={{ display: "flex", flexDirection: "column", flexWrap: "wrap" }}>

          {/* <div>{JSON.stringify(el)}</div> */}
          {index != 0 ? <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>{providerList[el.provider]}</div>
            <div>
              <Button onClick={() => handleRemove(el.provider, el.user_id)}>
                <span>Remove account</span>

                {pendingIds && (
                  <Spinner
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden={true}
                    className="ml-2 align-baseline"
                  >
                    <span className="sr-only">Removing...</span>
                  </Spinner>

                )}
              </Button>
            </div>
          </div> : null}
          {
            el.profileData ?
              <>
                <div><strong>Name:</strong>
                  {
                    el.profileData.name ?
                      el.profileData.name :
                      "N/A"
                  }
                </div>
                <div><strong>Email:</strong>
                  {
                    el.profileData.email ?
                      el.profileData.email :
                      "N/A"
                  }
                </div>
              </>
              : null
          }
        </div>
      ) : null}

    </>
  );
}

export default SettingsLinks;
