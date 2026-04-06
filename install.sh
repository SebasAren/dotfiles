stow nvim

# Install pass-cli (Proton Pass CLI) for API key management
# Self-updates via: pass-cli update
if ! command -v pass-cli &>/dev/null; then
  echo "Installing Proton Pass CLI..."
  curl -fsSL https://proton.me/download/pass-cli/install.sh | bash
fi
