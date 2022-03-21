import axios from "axios";

const handler = async (req, res) => {
    try {
        var options = {
            method: 'POST',
            url: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/oauth/token`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                "grant_type": "authorization_code",
                "client_id": `${process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}`,
                "client_secret": process.env.NEXT_PUBLIC_AUTH0_CLIENT_SECRET,
                "code": req.query.code,
                "redirect_uri": `${req.query.url}/auth0-callback`,
            })
        };

        let result = await axios.request(options)
        return await res.json(await result.data);
    } catch (error) {
        return res.json({ error })
    }

}
export default handler