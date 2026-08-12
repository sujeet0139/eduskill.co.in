"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Shared State -> District cascading selector (dev-prompt item #23: "Reuse
// the same State->District component on the student registration form").
// Pass `token` for the admin-authenticated endpoints (colleges form); omit
// it to use the public endpoints (student registration form).
export function StateDistrictSelect({ state, districtId, onStateChange, onDistrictChange, token, className = "" }) {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    const url = token ? "/api/districts/states" : "/api/public/states";
    api.get(url, token).then((d) => setStates(d.states || [])).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!state) { setDistricts([]); return; }
    const url = token ? `/api/districts?state=${encodeURIComponent(state)}` : `/api/public/districts?state=${encodeURIComponent(state)}`;
    api.get(url, token).then((d) => setDistricts(d.districts || [])).catch(() => {});
  }, [state, token]);

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">State</span>
        <select
          value={state || ""}
          onChange={(e) => { onStateChange(e.target.value); onDistrictChange(""); }}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          <option value="">— Select state —</option>
          {states.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">District</span>
        <select
          value={districtId || ""}
          onChange={(e) => onDistrictChange(e.target.value)}
          disabled={!state}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-100"
        >
          <option value="">{state ? "— Select district —" : "Select a state first"}</option>
          {districts.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </select>
      </label>
    </div>
  );
}
