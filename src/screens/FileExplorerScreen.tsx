import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useServer } from "../context/ServerContext";
import type { FileNode, FileStatus } from "../types/opencode";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  ts: { icon: "logo-javascript", color: "#3178c6" },
  tsx: { icon: "logo-react", color: "#61dafb" },
  js: { icon: "logo-javascript", color: "#f7df1e" },
  jsx: { icon: "logo-react", color: "#61dafb" },
  py: { icon: "logo-python", color: "#3572A5" },
  go: { icon: "code-outline", color: "#00ADD8" },
  rs: { icon: "code-outline", color: "#CE422B" },
  json: { icon: "document-text-outline", color: "#8b949e" },
  md: { icon: "document-text-outline", color: "#6e7681" },
  yaml: { icon: "document-outline", color: "#cb171e" },
  yml: { icon: "document-outline", color: "#cb171e" },
  css: { icon: "color-palette-outline", color: "#1572b6" },
  html: { icon: "globe-outline", color: "#e34c26" },
  sh: { icon: "terminal-outline", color: "#4eaa25" },
  gitignore: { icon: "git-branch-outline", color: "#f1502f" },
  dockerfile: { icon: "cube-outline", color: "#0db7ed" },
};

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? FILE_ICONS[name.toLowerCase()] ?? { icon: "document-outline", color: "#8b949e" };
}

function FileRow({
  node,
  depth,
  statuses,
  onPress,
  onExpand,
  isExpanded,
}: {
  node: FileNode;
  depth: number;
  statuses: Record<string, FileStatus>;
  onPress: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const isDir = node.type === "directory";
  const status = statuses[node.path];
  const { icon, color } = isDir
    ? { icon: isExpanded ? "folder-open-outline" : "folder-outline", color: "#f0883e" }
    : getFileIcon(node.name);

  return (
    <TouchableOpacity
      onPress={isDir ? onExpand : onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        paddingLeft: 12 + depth * 16,
        paddingRight: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#161b22",
      }}
    >
      {isDir && (
        <Ionicons
          name={isExpanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color="#6e7681"
          style={{ marginRight: 4 }}
        />
      )}
      {!isDir && <View style={{ width: 18 }} />}
      <Ionicons name={icon as any} size={16} color={color} style={{ marginRight: 8 }} />
      <Text style={{ color: "#e6edf3", fontSize: 14, flex: 1 }} numberOfLines={1}>
        {node.name}
      </Text>
      {status && (
        <Text
          style={{
            fontSize: 11,
            color:
              status.status === "M"
                ? "#d29922"
                : status.status === "A"
                ? "#3fb950"
                : "#f85149",
            fontFamily: "monospace",
          }}
        >
          {status.status}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface TreeNode extends FileNode {
  depth: number;
  isExpanded?: boolean;
}

export default function FileExplorerScreen() {
  const navigation = useNavigation<Nav>();
  const { client } = useServer();
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedChildren, setExpandedChildren] = useState<Record<string, FileNode[]>>({});
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [nodes, fileStatuses] = await Promise.all([
        client.listFiles(),
        client.getFileStatus(),
      ]);
      setRootNodes(nodes);
      const statusMap: Record<string, FileStatus> = {};
      fileStatuses.forEach((f) => (statusMap[f.path] = f));
      setStatuses(statusMap);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    load();
  }, []);

  const toggleExpand = async (node: FileNode) => {
    const path = node.path;
    if (expandedPaths.has(path)) {
      const next = new Set(expandedPaths);
      next.delete(path);
      setExpandedPaths(next);
    } else {
      if (!expandedChildren[path]) {
        try {
          const children = await client?.listFiles(path) ?? [];
          setExpandedChildren((prev) => ({ ...prev, [path]: children }));
        } catch {}
      }
      const next = new Set(expandedPaths);
      next.add(path);
      setExpandedPaths(next);
    }
  };

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await client?.findFiles(q, { limit: 50 }) ?? [];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Flatten tree for FlatList
  const flattenTree = useCallback(
    (nodes: FileNode[], depth = 0): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const isExpanded = expandedPaths.has(node.path);
        result.push({ ...node, depth, isExpanded });
        if (isExpanded && expandedChildren[node.path]) {
          result.push(...flattenTree(expandedChildren[node.path], depth + 1));
        }
      }
      return result;
    },
    [expandedPaths, expandedChildren]
  );

  const treeData = flattenTree(rootNodes);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }} edges={["bottom"]}>
      {/* Search */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#30363d",
          backgroundColor: "#161b22",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#21262d",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#30363d",
            paddingHorizontal: 10,
          }}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#58a6ff" />
          ) : (
            <Ionicons name="search-outline" size={16} color="#6e7681" />
          )}
          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder="Search files…"
            placeholderTextColor="#6e7681"
            style={{ flex: 1, color: "#e6edf3", fontSize: 14, paddingVertical: 8, marginLeft: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={16} color="#6e7681" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#58a6ff" />
        </View>
      ) : searchResults !== null ? (
        /* Search results */
        <FlatList
          data={searchResults}
          keyExtractor={(p) => p}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("CodeEditor", { path: item })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#161b22",
              }}
            >
              <Ionicons
                name={getFileIcon(item.split("/").pop() ?? "").icon as any}
                size={16}
                color={getFileIcon(item.split("/").pop() ?? "").color}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#e6edf3", fontSize: 14 }} numberOfLines={1}>
                  {item.split("/").pop()}
                </Text>
                <Text style={{ color: "#6e7681", fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                  {item}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Text style={{ color: "#6e7681" }}>No files found</Text>
            </View>
          }
        />
      ) : (
        /* File tree */
        <FlatList
          data={treeData}
          keyExtractor={(n) => n.path}
          renderItem={({ item }) => (
            <FileRow
              node={item}
              depth={item.depth}
              statuses={statuses}
              isExpanded={item.isExpanded ?? false}
              onPress={() => navigation.navigate("CodeEditor", { path: item.path })}
              onExpand={() => toggleExpand(item)}
            />
          )}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Ionicons name="folder-open-outline" size={48} color="#30363d" />
              <Text style={{ color: "#6e7681", marginTop: 12 }}>Empty directory</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
