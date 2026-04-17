import React from "react";
import { Sandpack } from "@codesandbox/sandpack-react";
import { useTheme } from "next-themes";

interface CodeSandboxProps {
  code: string;
}

export function CodeSandbox({ code }: CodeSandboxProps) {
  const { theme } = useTheme();

  // Try to determine the template based on code signature
  let template: "vanilla" | "react" | "vanilla-ts" | "react-ts" = "vanilla";
  let activeFile = "/index.js";
  
  if (code.includes("import React") || code.includes("export default function") || code.includes("useState") || code.includes("<HTML")) {
    template = code.includes("interface") || code.includes("type ") ? "react-ts" : "react";
    activeFile = template === "react-ts" ? "/App.tsx" : "/App.js";
  } else if (code.includes("interface") || code.includes("type ")) {
    template = "vanilla-ts";
    activeFile = "/index.ts";
  }

  // Determine if it's purely HTML/CSS just for index.html
  if (code.trim().startsWith("<!DOCTYPE html>") || code.trim().startsWith("<html") || (code.includes("<div") && !code.includes("import"))) {
     // Overwrite active file to index.html for vanilla
     activeFile = "/index.html";
     template = "vanilla";
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Sandpack
        template={template}
        theme={theme === "light" ? "light" : "dark"}
        files={{
          [activeFile]: code,
        }}
        options={{
          showNavigator: false,
          showTabs: true,
          editorHeight: 400,
          showLineNumbers: true,
          wrapContent: true,
        }}
      />
    </div>
  );
}
