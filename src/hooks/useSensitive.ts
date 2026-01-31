import { useState, useEffect, createContext, useContext } from "react";

const SensitiveContext = createContext({ hidden: true, toggle: () => {} });

export function useSensitiveState() {
  const [hidden, setHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sensitive-hidden") !== "false";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("sensitive-hidden", String(hidden));
  }, [hidden]);

  const toggle = () => setHidden((h) => !h);

  return { hidden, toggle };
}

export const SensitiveProvider = SensitiveContext.Provider;
export const useSensitive = () => useContext(SensitiveContext);
