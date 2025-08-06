import { useEffect, useState } from "react";
import axios from "axios";

export default function useSubscription() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    axios.get("http://localhost:4000/api/subscription/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ status: 'none', plan: 'Free' }));
  }, []);

  return status;
}