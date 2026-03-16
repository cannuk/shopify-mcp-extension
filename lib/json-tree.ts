export function createJsonTree(data: unknown, open = true): HTMLElement {
  if (data === null) return primitive("null", "json-null");
  if (data === undefined) return primitive("undefined", "json-null");

  switch (typeof data) {
    case "string": {
      // If the string is JSON, parse and render as a tree
      if (data.length > 1 && (data[0] === "{" || data[0] === "[")) {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === "object" && parsed !== null) {
            return createJsonTree(parsed, open);
          }
        } catch {
          // Not JSON, render as string
        }
      }
      return primitive(`"${data}"`, "json-string");
    }
    case "number":
      return primitive(String(data), "json-number");
    case "boolean":
      return primitive(String(data), "json-boolean");
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return primitive("[]", "json-bracket");
    const details = document.createElement("details");
    if (open) details.open = true;
    details.className = "json-node";
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="json-bracket">Array</span> <span class="json-count">(${data.length})</span>`;
    details.appendChild(summary);
    data.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "json-row";
      row.innerHTML = `<span class="json-index">${i}:</span> `;
      row.appendChild(createJsonTree(item, false));
      details.appendChild(row);
    });
    return details;
  }

  if (typeof data === "object") {
    const keys = Object.keys(data as Record<string, unknown>);
    if (keys.length === 0) return primitive("{}", "json-bracket");
    const details = document.createElement("details");
    if (open) details.open = true;
    details.className = "json-node";
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="json-bracket">Object</span> <span class="json-count">{${keys.length}}</span>`;
    details.appendChild(summary);
    keys.forEach((key) => {
      const row = document.createElement("div");
      row.className = "json-row";
      row.innerHTML = `<span class="json-key">${esc(key)}:</span> `;
      row.appendChild(createJsonTree((data as Record<string, unknown>)[key], false));
      details.appendChild(row);
    });
    return details;
  }

  return primitive(String(data), "json-null");
}

function primitive(text: string, className: string): HTMLElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
