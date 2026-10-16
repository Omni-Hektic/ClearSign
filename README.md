# ⚖ ClearSign

> Nobody should sign what they don't understand.

ClearSign is a browser extension that translates Terms of Service, Privacy Policies, and legal contracts into plain English — instantly, at the point of decision.

## Structure

```
ClearSign/
├── extension/          # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background/     # Service worker
│   ├── content/        # Page detection script
│   ├── popup/          # Extension popup UI
│   ├── options/        # Settings page
│   ├── styles/         # Shared CSS
│   └── icons/          # Extension icons
└── landing/            # Marketing landing page
```

## Setup

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder
4. Open the extension options and add your [OpenRouter](https://openrouter.ai) API key

## Mission

> Nobody should sign something they don't understand. ClearSign translates legal language into plain English — instantly, privately, at the point of decision.
