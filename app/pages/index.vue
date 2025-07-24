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
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  "wss://localhost:1234",
  "mincedcloves-room",
  ydoc
);
interface FileData {
  content: string;
  language: string;
}

const yFiles = ydoc.getMap<FileData>("files");
const yFileTexts = ydoc.getMap<Y.Text>("fileTexts");

const files = computed(() =>
  Array.from(yFiles.entries()).map(([name, data], id) => ({
    id,
    name,
    ...(typeof data === "object" && data !== null ? data : {}),
  }))
);

const currentFileName = ref("index.html");

function getYTextForFile(fileName: string): Y.Text {
  let yText = yFileTexts.get(fileName);
  if (!yText) {
    // If file exists, initialize Y.Text with its content
    const fileData = yFiles.get(fileName);
    yText = new Y.Text();
    if (fileData?.content) {
      yText.insert(0, fileData.content);
    }
    yFileTexts.set(fileName, yText);
  }
  return yText;
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
      fontFamily: "'Hack', monospace",
      fontSize: "16px",
      height: "100%",
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
  const fileData = yFiles.get(fileName);
  const yTextInst = getYTextForFile(fileName);
  const langExt = getLanguageExtension(fileData?.language || "javascript");
  const state = EditorState.create({
    doc: yTextInst.toString(),
    extensions: [
      ...extensions,
      yCollab(yTextInst, provider.awareness),
      language.of(langExt),
    ],
  });
  if (view.value) {
    view.value.destroy();
  }
  view.value = new EditorView({
    state,
    parent: editor.value as Element,
  });
}

onMounted(() => {
  createEditorForFile(currentFileName.value);
});

watch(currentFileName, (newFile) => {
  createEditorForFile(newFile);
});
</script>

<style scoped>
.editor {
  height: 100vh;
}
</style>
