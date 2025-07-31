<template>
  <div class="h-[8vh] w-full border-b border-gray-300">
    <!-- search bar on the left, profile pictures on the right -->
    <div class="flex justify-between items-center p-3">
      <UInput
        icon="i-lucide-search"
        size="md"
        color="neutral"
        variant="outline"
        placeholder="Search..."
        class="w-1/2"
      />
      <div class="flex gap-2">
        <!-- For each user from awareness, show a placeholder profile picture -->
        <div
          v-for="user in users"
          :key="user.id"
          class="cursor-pointer"
          @click="goToUser(user)"
        >
          <UTooltip
            :text="`${user.name} editing ${user.file}`"
            :placement="'bottom'"
          >
            <img
              :src="user.avatar"
              :alt="user.name"
              class="w-8 h-8 rounded-full border border-gray-300"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </div>
  <div class="flex h-[92vh]">
    <div class="border-r border-gray-300 w-1/4 bg-white">
      <div class="p-4">
        <h3 class="text-xl font-bold mt-4 mb-4">mincedcloves</h3>
      </div>
      <!-- file list -->
      <ul class="mt-8">
        <li
          v-for="file in files"
          :key="file.name"
          @click="openFile(file.id)"
          class="text-sm hover:bg-gray-100 cursor-pointer w-full px-4 py-1 font-[Hack]"
          :class="{
            'bg-gray-200': currentFileName === file.name,
          }"
        >
          {{ file.name }}
        </li>
      </ul>
    </div>
    <div
      id="editor"
      ref="editor"
      data-gramm="false"
      class="editor w-full"
    ></div>
  </div>
</template>

<script lang="ts" setup>
// Core CM packages
import { Compartment, EditorState } from "@codemirror/state";
import { watch, ref, computed, onMounted, onUnmounted } from "vue";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";

// Theme
// import { material } from '@uiw/codemirror-theme-material';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEQ3VBr3aAlBAmuyhfD2T3IXrYHm3pN5Q",
  authDomain: "mincedcloves.firebaseapp.com",
  projectId: "mincedcloves",
  storageBucket: "mincedcloves.firebasestorage.app",
  messagingSenderId: "901752809962",
  appId: "1:901752809962:web:7d146d3f7c264b6088aa93",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Languages
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { vue } from "@codemirror/lang-vue";
const language = new Compartment();

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { yCollab } from "y-codemirror.next";

const ydoc = new Y.Doc();

// Generate a unique client ID for this session
const clientId = `client-${Date.now()}-${Math.random()
  .toString(36)
  .substr(2, 9)}`;

const provider = new HocuspocusProvider({
  url: "ws://localhost:1234",
  name: "mincedcloves-room",
  document: ydoc,
});

interface FileData {
  content: string;
  language: string;
}

const yFiles = ydoc.getMap<FileData>("files");

// Wait for the provider to sync before accessing data
const isConnected = ref(false);

provider.on("status", (event: any) => {
  console.log(`Provider status [${clientId}]:`, event.status);

  if (event.status === "disconnected" && isConnected.value) {
    console.log("Server disconnected, cleaning up state");
    // Reset connection state
    isConnected.value = false;
    // Destroy current editor to prevent state conflicts
    if (view.value) {
      view.value.destroy();
      view.value = null;
    }
  }

  if (event.status === "connected") {
    console.log(`Client ${clientId} connected successfully`);
  }

  isConnected.value = event.status === "connected";
});

provider.on("sync", (isSynced: boolean) => {
  console.log(`Provider synced [${clientId}]:`, isSynced);
  if (isSynced) {
    isConnected.value = true;
    console.log("Files available:", Array.from(yFiles.keys()));
    console.log("yFiles size:", yFiles.size);

    // Always recreate editor after sync to ensure clean state
    if (yFiles.size > 0 && editor.value) {
      console.log("Sync event: files ready, creating editor");
      setTimeout(() => {
        createEditorForFile(currentFileName.value);
      }, 50);
    }
  }
});

// Add disconnect handler to ensure cleanup
provider.on("disconnect", () => {
  console.log(`Provider disconnected [${clientId}]`);
  isConnected.value = false;

  // Clean up awareness state when disconnected
  if (provider.awareness) {
    provider.awareness.setLocalState(null);
  }
});

// Listen for changes to the files map
yFiles.observe(() => {
  console.log("yFiles changed, current files:", Array.from(yFiles.keys()));
  console.log("isConnected.value:", isConnected.value);
  console.log("yFiles.size:", yFiles.size);
  console.log("view.value:", view.value);
  console.log("editor.value:", editor.value);
});

const files = computed(() => {
  if (!isConnected.value) return [];
  return Array.from(yFiles.entries()).map(([name, data], id) => ({
    id,
    name,
    ...(typeof data === "object" && data !== null ? data : {}),
  }));
});

function getYTextForFile(fileName: string): Y.Text {
  // Always get the Y.Text instance directly from the document
  return ydoc.getText(fileName);
}

const openFile = (id: number) => {
  const file = files.value[id];
  if (file) {
    currentFileName.value = file.name;
  }
};

const editor = useTemplateRef("editor");
const view = ref<EditorView | null>(null);
const extensions = [
  keymap.of([
    indentWithTab,
    ...foldKeymap,
    ...historyKeymap,
    ...completionKeymap,
    ...closeBracketsKeymap,
    ...searchKeymap,
    ...defaultKeymap,
  ]),
  lineNumbers(),
  highlightActiveLine(),
  highlightSpecialChars(),
  history(),
  closeBrackets(),
  autocompletion(),
  bracketMatching(),
  indentOnInput(),
  highlightSelectionMatches(),
  foldGutter(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme({
    "&": {
      fontFamily: "'Hack', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      fontSize: "16px",
      height: "100%",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      fontFamily: "'Hack', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 8px",
      color: "#6b7280",
      fontFamily: "'Hack', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    },
    ".cm-content": {
      fontFamily: "'Hack', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      padding: "16px 0",
    },
    ".cm-focused": {
      outline: "none",
    },
  }),
];

function getLanguageExtension(lang: string) {
  if (lang === "html") return html();
  if (lang === "css") return css();
  if (lang === "json") return json();
  if (lang === "vue") return vue();
  return javascript();
}

function createEditorForFile(fileName: string) {
  try {
    console.log("=== createEditorForFile called ===");
    console.log("fileName:", fileName);
    console.log("isConnected:", isConnected.value);
    console.log("editor.value:", editor.value);
    console.log("view.value:", view.value);

    if (!isConnected.value) {
      console.log("Not connected yet, waiting...");
      return;
    }

    if (!editor.value) {
      console.log("Editor DOM element not ready yet");
      return;
    }

    console.log("Creating editor for file:", fileName);
    console.log("Available files:", Array.from(yFiles.keys()));
    console.log("yFiles size:", yFiles.size);

    const fileData = yFiles.get(fileName);
    if (!fileData) {
      console.error(`File data not found for: ${fileName}`);
      console.error("All available files:", Array.from(yFiles.entries()));
      return;
    }

    console.log("File data found:", fileData);

    const yTextInst = getYTextForFile(fileName);
    console.log("Y.Text instance:", yTextInst);
    console.log("Y.Text content:", yTextInst.toString());

    const langExt = getLanguageExtension(fileData.language || "javascript");
    console.log("Language extension:", langExt);

    const state = EditorState.create({
      doc: yTextInst.toString(),
      extensions: [
        ...extensions,
        yCollab(yTextInst, provider.awareness),
        language.of(langExt),
      ],
    });

    console.log("EditorState created:", state);

    if (view.value) {
      console.log("Destroying existing view");
      view.value.destroy();
      view.value = null;
    }

    console.log("Creating new EditorView");
    view.value = new EditorView({
      state,
      parent: editor.value as Element,
    });

    console.log("EditorView created successfully:", view.value);
  } catch (error) {
    console.error("Error creating editor for file:", fileName, error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
  }
}

const currentFileName = ref("index.html");

// Awareness logic for user avatars
const users = ref<any[]>([]);

// Cleanup function to properly disconnect
const cleanup = () => {
  console.log(`Cleaning up connections for client ${clientId}...`);

  if (view.value) {
    view.value.destroy();
    view.value = null;
  }

  if (provider.awareness) {
    // Completely clear the local awareness state
    provider.awareness.setLocalState(null);

    console.log(`Cleared awareness state for client ${clientId}`);
  }

  if (provider) {
    provider.disconnect();
    provider.destroy();
  }
};

// Listen for page unload events to cleanup connections
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("unload", cleanup);
}

if (provider.awareness) {
  provider.awareness.on("update", () => {
    const states = Array.from(provider.awareness!.getStates().entries());
    console.log("Raw awareness states:", states);

    // Filter out null, undefined, empty states, and the current client
    const validStates = states.filter(
      ([clientStateId, state]: [number, any]) => {
        const isCurrentClient = clientStateId === provider.awareness!.clientID;
        const hasValidState =
          state &&
          state.userId &&
          state.name &&
          state.userId !== null &&
          state.name !== null;

        console.log(
          `Client ${clientStateId} (current: ${isCurrentClient}):`,
          state
        );

        // Exclude current client and invalid states
        return !isCurrentClient && hasValidState;
      }
    );

    console.log(
      "Filtered valid states (excluding current client):",
      validStates
    );

    users.value = validStates.map(
      ([clientStateId, state]: [number, any], idx: number) => ({
        id: state.userId,
        name: state.name,
        avatar:
          state.avatar ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${state.userId}`,
        file: state.currentFile,
        cursor: state.cursor,
      })
    );

    console.log("Updated users list:", users.value);
  });

  // Set local awareness state with unique client ID
  // Only set awareness state after we're properly connected
  const setAwarenessState = () => {
    if (provider.awareness && isConnected.value) {
      provider.awareness.setLocalStateField("userId", clientId);
      provider.awareness.setLocalStateField(
        "name",
        `User-${clientId.slice(-4)}`
      );
      provider.awareness.setLocalStateField(
        "avatar",
        `https://api.dicebear.com/7.x/identicon/svg?seed=${clientId}`
      );
      provider.awareness.setLocalStateField(
        "currentFile",
        currentFileName.value
      );
      provider.awareness.setLocalStateField("cursor", null);
      console.log(`Set awareness state for client ${clientId}`);
    }
  };

  // Wait for connection before setting awareness state
  watch(
    isConnected,
    (connected) => {
      if (connected) {
        setAwarenessState();
      }
    },
    { immediate: true }
  );
}

// Update awareness on file change
watch(currentFileName, (newFile) => {
  if (provider.awareness && isConnected.value) {
    provider.awareness.setLocalStateField("currentFile", newFile);
  }
});

// Update awareness on cursor change (example: you need to hook this to your editor events)
function updateCursor(cursor: any) {
  if (provider.awareness && isConnected.value) {
    provider.awareness.setLocalStateField("cursor", cursor);
  }
}

onMounted(() => {
  // Wait for connection and files to be available
  const unwatch = watch(
    isConnected,
    (connected) => {
      console.log("=== isConnected watch triggered ===");
      console.log("connected:", connected);
      console.log("yFiles.size:", yFiles.size);
      console.log("editor.value:", editor.value);

      if (connected) {
        // Give a small delay to ensure Y.Map is populated and DOM is ready
        setTimeout(() => {
          console.log("Attempting to create editor, yFiles size:", yFiles.size);
          if (yFiles.size > 0 && editor.value) {
            console.log("Conditions met, calling createEditorForFile");
            createEditorForFile(currentFileName.value);
            unwatch(); // Stop watching once connected and files are available
          } else {
            console.log(
              "No files available yet or DOM not ready, will retry when yFiles changes"
            );
            console.log("- yFiles.size > 0:", yFiles.size > 0);
            console.log("- editor.value exists:", !!editor.value);
          }
        }, 200);
      }
    },
    { immediate: true }
  );

  // Also watch for changes to yFiles in case files arrive after connection
  yFiles.observe(() => {
    console.log("=== yFiles.observe triggered ===");
    console.log("isConnected.value:", isConnected.value);
    console.log("yFiles.size:", yFiles.size);
    console.log("view.value:", view.value);
    console.log("editor.value:", editor.value);

    // Check if we have files and DOM ready, regardless of connection status
    // because files arriving means we're effectively connected
    if (yFiles.size > 0 && !view.value && editor.value) {
      console.log(
        "Files became available, creating editor (ignoring connection status)"
      );
      // Update connection status if not already set
      if (!isConnected.value) {
        console.log("Setting isConnected to true based on file availability");
        isConnected.value = true;
      }
      // Small delay to ensure DOM is stable
      setTimeout(() => {
        createEditorForFile(currentFileName.value);
      }, 50);
    } else {
      console.log("Conditions not met for creating editor:");
      console.log("- yFiles.size > 0:", yFiles.size > 0);
      console.log("- !view.value:", !view.value);
      console.log("- editor.value exists:", !!editor.value);
    }
  });
});

onUnmounted(() => {
  console.log("Component unmounting, cleaning up...");

  // Remove event listeners
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", cleanup);
    window.removeEventListener("unload", cleanup);
  }

  // Perform cleanup
  cleanup();
});

watch(currentFileName, (newFile) => {
  if (isConnected.value) {
    createEditorForFile(newFile);
  }
});

function goToUser(user: any) {
  if (user.file) {
    currentFileName.value = user.file;
    if (user.cursor && view.value) {
      view.value.dispatch({
        selection: { anchor: user.cursor },
        scrollIntoView: true,
      });
    }
  }
}
</script>

<style scoped></style>
