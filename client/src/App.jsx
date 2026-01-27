import { useState, useEffect } from 'react'
import './App.css'
import axios from 'axios'

function App() {
  const [data, setData] = useState({})

  useEffect(() => {

    axios.get('http://localhost:3000/api/data').then(res => {
      setData(res.data);
    }).catch(err => {
      console.error("Error fetching data: ", err)
    })

  },[])

  return (
    <>
      <div>
        {data.message}
      </div>
    </>
  )
}

export default App
