export const CODE_FRAME = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #faf7f2; color: #1d1915; font: 13px/1.5 ui-monospace, monospace; }
  pre { margin: 0; white-space: pre-wrap; padding: 12px; }
</style>
</head>
<body>
<pre id="out">Output appears here.</pre>
<script>
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Python"));
      document.head.appendChild(script);
    });
  }
  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.type !== "run") return;
    const out = document.getElementById("out");
    try {
      if (event.data.language === "python") {
        out.textContent = "Loading Python…";
        if (!window.__py) {
          await loadScript("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
          window.__py = await loadPyodide();
        }
        let text = "";
        window.__py.setStdout({ batched: (line) => { text += line + "\\n"; } });
        await window.__py.runPythonAsync(event.data.code);
        out.textContent = text || "Ran with no output.";
      } else {
        const logs = [];
        const consoleProxy = { log: (...args) => logs.push(args.map(String).join(" ")) };
        const result = new Function("console", event.data.code)(consoleProxy);
        let text = logs.join("\\n");
        if (result !== undefined) text += (text ? "\\n" : "") + String(result);
        out.textContent = text || "Ran with no output.";
      }
      parent.postMessage({ type: "result", ok: true, text: out.textContent }, "*");
    } catch (error) {
      out.textContent = error && error.message ? error.message : String(error);
      parent.postMessage({ type: "result", ok: false, text: out.textContent }, "*");
    }
  });
</script>
</body>
</html>`;
