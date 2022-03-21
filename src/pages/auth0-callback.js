import absoluteUrl from 'next-absolute-url'
import { useRouter } from 'next/router'
import fetch from 'node-fetch'
import React, { useLayoutEffect } from 'react'
import auth0 from 'util/auth0.js'


function Authcallback(props) {
  const router = useRouter()
  useLayoutEffect(() => {
    let code = new URL(router.asPath, location.origin).searchParams.get("code")
    console.log(code);
    if (code) {
      fetch(`/api/get-token?code=${code}&url=${props.origin}`).then(async res => res).then(async res2 => {
        let res = await res2.json()
        if (res) {
          console.log(res);
          if (res.access_token) {
            auth0.extended.setTokens(res)
          }
        }
      })
    }
    auth0.popup.callback()
  }, [])
  return null
}
export const getServerSideProps = async (context) => {
  const { req } = context;
  if (req) {
    let { origin } = absoluteUrl(req)
    return { props: { origin } }
  }
}
export default Authcallback
