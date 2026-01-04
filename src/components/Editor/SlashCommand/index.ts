import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { suggestion as defaultSuggestion } from "./suggestions";

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    console.log("SlashCommand extension: adding ProseMirror plugins");
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        render: this.options.suggestion?.render || defaultSuggestion.render,
        items: this.options.suggestion?.items || defaultSuggestion.items,
        command:
          this.options.suggestion?.command ||
          (({ editor, range, props }: any) => {
            props.command({ editor, range });
          }),
      }),
    ];
  },
});

export default SlashCommand;
export { defaultSuggestion as suggestion };
