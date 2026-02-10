import { useState, useCallback, useEffect } from "react";
import { fetchAgents, setCurrentAgent, type AgentInfo } from "../api";

const STORAGE_KEY = "memory-viewer-selected-agent";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "default";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAgents();
      setAgents(data);
      setError(null);
      
      // Validate selected agent still exists
      const exists = data.find((a) => a.id === selectedAgentId);
      if (!exists && data.length > 0) {
        // Fall back to default or first agent
        const defaultAgent = data.find((a) => a.id === "default") || data[0];
        setSelectedAgentId(defaultAgent.id);
        setCurrentAgent(defaultAgent.id);
        localStorage.setItem(STORAGE_KEY, defaultAgent.id);
      } else if (exists) {
        setCurrentAgent(selectedAgentId);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  const selectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setCurrentAgent(agentId);
    localStorage.setItem(STORAGE_KEY, agentId);
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  return {
    agents,
    selectedAgent,
    selectedAgentId,
    selectAgent,
    loading,
    error,
    refresh: loadAgents,
  };
}
