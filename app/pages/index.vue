<template>
  <div class="flex h-screen">
    <div class="border-r border-gray-300 w-1/4 bg-white">
      <div class="p-4">
        <h1 class="text-3xl font-bold mt-4 mb-4">mincedcloves</h1>
      </div>
      <!-- file list -->
      <ul class="mt-8">
        <li
          v-for="file in files"
          :key="file.name"
          @click="openFile(file.id)"
          class="text-blue-600 hover:bg-gray-200 cursor-pointer w-full px-4 py-1 font-[Hack]"
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
import { watch } from "vue";
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
  console.log("Provider status:", event.status);
  isConnected.value = event.status === "connected";
});

provider.on("sync", (isSynced: boolean) => {
  console.log("Provider synced:", isSynced);
  if (isSynced) {
    isConnected.value = true;
    console.log("Files available:", Array.from(yFiles.keys()));
    console.log("yFiles size:", yFiles.size);
    
    // Trigger editor creation if files are ready
    if (yFiles.size > 0 && editor.value && !view.value) {
      console.log("Sync event: files ready, creating editor");
      setTimeout(() => {
        createEditorForFile(currentFileName.value);
      }, 50);
    }
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
      console.log("Files became available, creating editor (ignoring connection status)");
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
  if (view.value) {
    view.value.destroy();
    view.value = null;
  }
  if (provider) {
    provider.destroy();
  }
});

watch(currentFileName, (newFile) => {
  if (isConnected.value) {
    createEditorForFile(newFile);
  }
});
</script>

<style scoped>
.editor {
  height: 100vh;
}
</style>
