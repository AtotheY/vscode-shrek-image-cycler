import * as vscode from "vscode";

let intervalId: NodeJS.Timeout | undefined;

interface Settings {
  imageUrls: string[];
  intervalMinutes: number;
}

const defaultImages = [
  "https://i.imgur.com/lBsiH4u.png",
  "https://i.imgur.com/771nDEc.png",
  "https://i.imgur.com/oL0mqN5.png",
  "https://i.imgur.com/2hJcobD.png",
  "https://i.imgur.com/9BzZDag.png",
  "https://i.imgur.com/O4u6CXU.png",
];

export function activate(context: vscode.ExtensionContext) {
  let openSettingsDisposable = vscode.commands.registerCommand(
    "extension.openSettings",
    () => openSettings(context)
  );

  context.subscriptions.push(openSettingsDisposable);

  // Initialize default settings if not already set
  const currentSettings = context.globalState.get("imageCycleSettings");
  if (!currentSettings) {
    context.globalState.update("imageCycleSettings", {
      imageUrls: defaultImages,
      intervalMinutes: 4,
    });
  }
}

function openSettings(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "imageSettings",
    "Image Cycle Settings",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const settings: Settings = context.globalState.get("imageCycleSettings", {
    imageUrls: defaultImages,
    intervalMinutes: 4,
  });

  panel.webview.html = getSettingsWebviewContent(settings);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case "saveSettings":
          await context.globalState.update(
            "imageCycleSettings",
            message.settings
          );
          vscode.window.showInformationMessage("Settings saved successfully");
          break;
        case "startCycle":
          startImageCycle(context);
          break;
        case "stopCycle":
          stopImageCycle();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

function getSettingsWebviewContent(settings: Settings) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Cycle Settings</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            input, button { margin: 5px 0; }
            #urlList { margin-bottom: 10px; }
            .image-preview { width: 100px; height: 100px; object-fit: cover; margin-right: 10px; }
            .url-container { display: flex; align-items: center; margin-bottom: 10px; }
            .control-buttons { margin-top: 20px; }
            .control-buttons button { margin-right: 10px; }
        </style>
    </head>
    <body>
        <h2>Image Cycle Settings</h2>
        <div id="urlList"></div>
        <button onclick="addUrl()">Add URL</button>
        <br>
        <label for="interval">Interval (minutes):</label>
        <input type="number" id="interval" min="1" value="${
          settings.intervalMinutes
        }">
        <br>
        <button onclick="saveSettings()">Save Settings</button>
        <div class="control-buttons">
            <button onclick="startCycle()">Start Cycle</button>
            <button onclick="stopCycle()">Stop Cycle</button>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let urls = ${JSON.stringify(settings.imageUrls)};

            function renderUrls() {
                const urlList = document.getElementById('urlList');
                urlList.innerHTML = urls.map((url, index) => 
                    \`<div class="url-container">
                        <img src="\${url}" class="image-preview" onerror="this.src='https://via.placeholder.com/100x100?text=Invalid+URL'">
                        <div>
                            <input type="text" value="\${url}" onchange="updateUrl(\${index}, this.value)">
                            <button onclick="removeUrl(\${index})">Remove</button>
                        </div>
                    </div>\`
                ).join('');
            }

            function addUrl() {
                urls.push('');
                renderUrls();
            }

            function removeUrl(index) {
                urls.splice(index, 1);
                renderUrls();
            }

            function updateUrl(index, value) {
                urls[index] = value;
                renderUrls();
            }

            function saveSettings() {
                const interval = document.getElementById('interval').value;
                vscode.postMessage({
                    command: 'saveSettings',
                    settings: {
                        imageUrls: urls.filter(url => url.trim() !== ''),
                        intervalMinutes: parseInt(interval)
                    }
                });
            }

            function startCycle() {
                vscode.postMessage({ command: 'startCycle' });
            }

            function stopCycle() {
                vscode.postMessage({ command: 'stopCycle' });
            }

            renderUrls();
        </script>
    </body>
    </html>
  `;
}

function startImageCycle(context: vscode.ExtensionContext) {
  const settings: Settings = context.globalState.get("imageCycleSettings", {
    imageUrls: defaultImages,
    intervalMinutes: 4,
  });

  if (settings.imageUrls.length === 0) {
    vscode.window.showErrorMessage(
      "Please set image URLs in the settings first"
    );
    return;
  }

  if (intervalId) {
    vscode.window.showWarningMessage("Image cycle is already running");
    return;
  }

  intervalId = setInterval(
    () => showRandomImage(settings.imageUrls),
    settings.intervalMinutes * 60 * 1000
  );
  showRandomImage(settings.imageUrls);
  vscode.window.showInformationMessage("Started image cycle");
}

function stopImageCycle() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
    vscode.window.showInformationMessage("Stopped image cycle");
  } else {
    vscode.window.showWarningMessage("Image cycle is not running");
  }
}

function showRandomImage(imageUrls: string[]) {
  const randomUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];
  const panel = vscode.window.createWebviewPanel(
    "imageViewer",
    "Full Screen Image",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(randomUrl);
}

function getWebviewContent(imageUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Full Screen Image</title>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                height: 100%;
                overflow: hidden;
            }
            img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }
        </style>
    </head>
    <body>
        <img src="${imageUrl}" alt="Full Screen Image">
    </body>
    </html>
  `;
}

export function deactivate() {
  if (intervalId) {
    clearInterval(intervalId);
  }
}
