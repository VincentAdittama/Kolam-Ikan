import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Table as TableIcon,
  Quote,
  Minus,
  Type,
} from "lucide-react";
import { type Editor, type Range } from "@tiptap/core";
import { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import { CommandList } from "./CommandList";
import { type Instance, type Props } from "tippy.js";

export const suggestion = {
  items: ({ query }: { query: string }) => {
    return [
      {
        title: "Heading 1",
        description: "Big section heading",
        searchTerms: ["h1", "head", "large"],
        icon: Heading1,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 1 })
            .run();
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading",
        searchTerms: ["h2", "head", "medium"],
        icon: Heading2,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 2 })
            .run();
        },
      },
      {
        title: "Heading 3",
        description: "Small section heading",
        searchTerms: ["h3", "head", "small"],
        icon: Heading3,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 3 })
            .run();
        },
      },
      {
        title: 'Heading 4',
        description: 'Sub-section heading',
        searchTerms: ['h4', 'head', 'tiny'],
        icon: Heading3,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 4 })
            .run();
        },
      },
      {
        title: 'Heading 5',
        description: 'Sub-section heading',
        searchTerms: ['h5', 'head', 'tiny'],
        icon: Heading3,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 5 })
            .run();
        },
      },
      {
        title: 'Heading 6',
        description: 'Sub-section heading',
        searchTerms: ['h6', 'head', 'tiny'],
        icon: Heading3,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 6 })
            .run();
        },
      },
      {
        title: "Bullet List",
        description: "Create a simple bulleted list",
        searchTerms: ["unordered", "point", "list"],
        icon: List,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: "Numbered List",
        description: "Create a list with numbering",
        searchTerms: ["ordered", "list"],
        icon: ListOrdered,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: "Task List",
        description: "Track tasks with a checklist",
        searchTerms: ["todo", "check", "list"],
        icon: CheckSquare,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
      },
      {
        title: "Code Block",
        description: "Insert a code block with syntax highlighting",
        searchTerms: ["code", "pre", "snippet"],
        icon: Code,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: "Table",
        description: "Insert a table",
        searchTerms: ["table", "grid", "data"],
        icon: TableIcon,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      },
      {
        title: "Blockquote",
        description: "Insert a blockquote",
        searchTerms: ["quote", "cite"],
        icon: Quote,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: "Horizontal Rule",
        description: "Insert a horizontal divider",
        searchTerms: ["hr", "divider", "line"],
        icon: Minus,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
      {
        title: "Text",
        description: "Plain text",
        searchTerms: ["p", "para", "normal"],
        icon: Type,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode("paragraph").run();
        },
      },
    ].filter((item) => {
      if (typeof query !== "string" || !query) return true;
      const lowerQuery = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery) ||
        (item.searchTerms &&
          item.searchTerms.some((term) => term.includes(lowerQuery)))
      );
    });
  },

  render: () => {
    let component: ReactRenderer<{ onKeyDown: (props: { event: globalThis.KeyboardEvent }) => boolean }>;
    let popup: Instance<Props> | null = null;

    return {
      onStart: (props: SuggestionProps) => {
        console.log('SlashCommand onStart', props);
        component = new ReactRenderer(CommandList, {
          props: {
            ...props,
            onSelect: () => {
              popup?.hide();
            }
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          console.warn('SlashCommand: No clientRect provided');
          return;
        }

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props: SuggestionProps) {
        console.log('SlashCommand onUpdate', props);
        component.updateProps({
          ...props,
          onSelect: () => {
            popup?.hide();
          }
        });

        if (!props.clientRect) {
          return;
        }

        popup?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }

        if (props.event.key === "Enter") {
          // The command will be executed by CommandList, but we need to hide the popup
          // since the suggestion exit might not trigger immediately or correctly
          setTimeout(() => {
            popup?.hide();
          }, 0);
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        console.log('SlashCommand onExit');
        popup?.destroy();
        component?.destroy();
      },
    };
  },
};
