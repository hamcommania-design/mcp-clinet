"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type {
  MCPServerConfig,
  MCPServerState,
  MCPConnectionStatus,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPToolCallResult,
  MCPPromptResult,
  MCPResourceResult,
  MCPSettings,
} from "@/app/types";

const MCP_SERVERS_STORAGE_KEY = "mcp-servers";
const MCP_SETTINGS_VERSION = "1.0";

interface MCPContextType {
  servers: MCPServerState[];
  addServer: (config: MCPServerConfig) => void;
  updateServer: (config: MCPServerConfig) => void;
  removeServer: (serverId: string) => void;
  connectServer: (serverId: string) => Promise<void>;
  disconnectServer: (serverId: string) => Promise<void>;
  refreshServerCapabilities: (serverId: string) => Promise<void>;
  callTool: (
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<MCPToolCallResult>;
  getPrompt: (
    serverId: string,
    promptName: string,
    args: Record<string, string>
  ) => Promise<MCPPromptResult>;
  readResource: (serverId: string, uri: string) => Promise<MCPResourceResult>;
  exportSettings: () => MCPSettings;
  importSettings: (settings: MCPSettings) => void;
  getConnectedServers: () => MCPServerState[];
}

const MCPContext = createContext<MCPContextType | null>(null);

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error("useMCP must be used within an MCPProvider");
  }
  return context;
}

interface MCPProviderProps {
  children: ReactNode;
}

export function MCPProvider({ children }: MCPProviderProps) {
  const [servers, setServers] = useState<MCPServerState[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load servers from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedServers = localStorage.getItem(MCP_SERVERS_STORAGE_KEY);
      if (savedServers) {
        const configs: MCPServerConfig[] = JSON.parse(savedServers);
        const serverStates: MCPServerState[] = configs.map((config) => ({
          config,
          status: "disconnected" as MCPConnectionStatus,
          tools: [],
          prompts: [],
          resources: [],
        }));
        setServers(serverStates);
      }
    } catch (error) {
      console.error("Failed to load MCP servers from localStorage:", error);
    }
    setIsInitialized(true);
  }, []);

  // Save servers to localStorage when configs change
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;

    const configs = servers.map((s) => s.config);
    localStorage.setItem(MCP_SERVERS_STORAGE_KEY, JSON.stringify(configs));
  }, [servers, isInitialized]);

  // Sync connection status with backend on mount
  useEffect(() => {
    if (!isInitialized) return;

    const syncConnectionStatus = async () => {
      try {
        const response = await fetch("/api/mcp/status");
        if (response.ok) {
          const { connectedServers } = await response.json();
          setServers((prev) =>
            prev.map((server) => ({
              ...server,
              status: connectedServers.includes(server.config.id)
                ? "connected"
                : "disconnected",
            }))
          );
        }
      } catch (error) {
        console.error("Failed to sync MCP connection status:", error);
      }
    };

    syncConnectionStatus();
  }, [isInitialized]);

  const addServer = useCallback((config: MCPServerConfig) => {
    setServers((prev) => {
      // Check if server with same ID already exists
      if (prev.some((s) => s.config.id === config.id)) {
        console.warn(`Server with ID ${config.id} already exists`);
        return prev;
      }
      return [
        ...prev,
        {
          config,
          status: "disconnected" as MCPConnectionStatus,
          tools: [],
          prompts: [],
          resources: [],
        },
      ];
    });
  }, []);

  const updateServer = useCallback((config: MCPServerConfig) => {
    setServers((prev) =>
      prev.map((server) =>
        server.config.id === config.id
          ? { ...server, config }
          : server
      )
    );
  }, []);

  const removeServer = useCallback(async (serverId: string) => {
    // Disconnect first if connected
    const server = servers.find((s) => s.config.id === serverId);
    if (server?.status === "connected") {
      try {
        await fetch("/api/mcp/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId }),
        });
      } catch (error) {
        console.error("Failed to disconnect server before removal:", error);
      }
    }

    setServers((prev) => prev.filter((s) => s.config.id !== serverId));
  }, [servers]);

  const connectServer = useCallback(async (serverId: string) => {
    const server = servers.find((s) => s.config.id === serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Update status to connecting
    setServers((prev) =>
      prev.map((s) =>
        s.config.id === serverId
          ? { ...s, status: "connecting" as MCPConnectionStatus, error: undefined }
          : s
      )
    );

    try {
      const response = await fetch("/api/mcp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(server.config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect");
      }

      // Update with connected status and capabilities
      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? {
                ...s,
                status: "connected" as MCPConnectionStatus,
                tools: data.tools || [],
                prompts: data.prompts || [],
                resources: data.resources || [],
                error: undefined,
              }
            : s
        )
      );
    } catch (error) {
      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? {
                ...s,
                status: "error" as MCPConnectionStatus,
                error: error instanceof Error ? error.message : "Connection failed",
              }
            : s
        )
      );
      throw error;
    }
  }, [servers]);

  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      const response = await fetch("/api/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? {
                ...s,
                status: "disconnected" as MCPConnectionStatus,
                tools: [],
                prompts: [],
                resources: [],
                error: undefined,
              }
            : s
        )
      );
    } catch (error) {
      console.error("Failed to disconnect server:", error);
      throw error;
    }
  }, []);

  const refreshServerCapabilities = useCallback(async (serverId: string) => {
    const server = servers.find((s) => s.config.id === serverId);
    if (!server || server.status !== "connected") {
      throw new Error("Server is not connected");
    }

    try {
      const [toolsRes, promptsRes, resourcesRes] = await Promise.all([
        fetch(`/api/mcp/tools?serverId=${serverId}`),
        fetch(`/api/mcp/prompts?serverId=${serverId}`),
        fetch(`/api/mcp/resources?serverId=${serverId}`),
      ]);

      const [toolsData, promptsData, resourcesData] = await Promise.all([
        toolsRes.json(),
        promptsRes.json(),
        resourcesRes.json(),
      ]);

      setServers((prev) =>
        prev.map((s) =>
          s.config.id === serverId
            ? {
                ...s,
                tools: (toolsData.tools || []) as MCPTool[],
                prompts: (promptsData.prompts || []) as MCPPrompt[],
                resources: (resourcesData.resources || []) as MCPResource[],
              }
            : s
        )
      );
    } catch (error) {
      console.error("Failed to refresh server capabilities:", error);
      throw error;
    }
  }, [servers]);

  const callTool = useCallback(
    async (
      serverId: string,
      toolName: string,
      args: Record<string, unknown>
    ): Promise<MCPToolCallResult> => {
      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, toolName, args }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to call tool");
      }

      return data.result;
    },
    []
  );

  const getPrompt = useCallback(
    async (
      serverId: string,
      promptName: string,
      args: Record<string, string>
    ): Promise<MCPPromptResult> => {
      const response = await fetch("/api/mcp/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, promptName, args }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get prompt");
      }

      return data.result;
    },
    []
  );

  const readResource = useCallback(
    async (serverId: string, uri: string): Promise<MCPResourceResult> => {
      const response = await fetch("/api/mcp/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, uri }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to read resource");
      }

      return data.result;
    },
    []
  );

  const exportSettings = useCallback((): MCPSettings => {
    return {
      version: MCP_SETTINGS_VERSION,
      servers: servers.map((s) => s.config),
    };
  }, [servers]);

  const importSettings = useCallback((settings: MCPSettings) => {
    if (!settings.servers || !Array.isArray(settings.servers)) {
      throw new Error("Invalid settings format");
    }

    const newServerStates: MCPServerState[] = settings.servers.map((config) => ({
      config,
      status: "disconnected" as MCPConnectionStatus,
      tools: [],
      prompts: [],
      resources: [],
    }));

    setServers(newServerStates);
  }, []);

  const getConnectedServers = useCallback(() => {
    return servers.filter((s) => s.status === "connected");
  }, [servers]);

  const value: MCPContextType = {
    servers,
    addServer,
    updateServer,
    removeServer,
    connectServer,
    disconnectServer,
    refreshServerCapabilities,
    callTool,
    getPrompt,
    readResource,
    exportSettings,
    importSettings,
    getConnectedServers,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}

