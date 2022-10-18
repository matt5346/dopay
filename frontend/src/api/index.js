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

export async function uploadData (transaction_message, permit_message, transaction_sign, isPermit, native) {
  let result = null

  const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": '*'
  };

  try {
    console.log(transaction_message, 'uploadData')
    result = await api.get("/",  transaction_message, headers)

    console.log(result, "RESULT")
  } catch(err) {
    console.log(err, "error modifyPicture")
  }

  return result ? result.data : null
}
