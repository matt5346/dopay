import axios from "axios"

const api  = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 60000,
  // headers: {
  //   post: {
  //     "Access-Control-Allow-Origin": '*'
  //   }
  // }
})

export default api

export async function uploadData (invoice_params, invoice_signature) {
  let result = null

  let data = {
    "invoice_params" : invoice_params,
    "invoice_signature" : invoice_signature
  }

  const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": '*'
  };

  try {
    console.log(data)
    result = await api.post("/send_invoice/", data, headers)

    console.log(result, "RESULT")
  } catch(err) {
    console.log(err, "error modifyPicture")
  }

  return result ? result.data : null
}
