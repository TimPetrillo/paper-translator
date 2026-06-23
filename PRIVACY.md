# Privacy Policy

Last updated: 2026-06-23

Paper Translator is a local-first browser extension. It has no analytics, advertising, account system, or project-operated backend.

## Data stored locally

The extension stores the API Key, Base URL, model name, translation mode, display mode, concurrency, and timeout in `chrome.storage.local`. It does not use browser sync storage.

## Data sent externally

When the user explicitly tests an API connection or starts translation, the extension sends the required request to the API endpoint configured by that user. Translation requests contain the selected model name, translation instructions, and chunks of visible page text. Depending on the selected protocol, the configured API Key is sent using Bearer authorization, `x-api-key`, or `x-goog-api-key`.

No data is sent to the Paper Translator maintainers. Users are responsible for reviewing the privacy, retention, and copyright policies of their chosen API provider.

## Permissions

The extension requests `storage`, `activeTab`, and broad host access. Broad host access is needed because academic papers and user-selected API servers can use arbitrary domains. The extension does not use these permissions to collect browsing history.

## Deletion

Users can clear the saved configuration from the Options page. Uninstalling the extension also normally removes its local extension storage according to browser behavior.

## Changes

Material privacy changes will be documented in the changelog and this file.
