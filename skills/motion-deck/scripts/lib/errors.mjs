// Build failures carry a code from the contract (section 7): E_SOURCE E_CONFIG E_THEME E_REMOTE E_ASSET_SIZE E_ASSET_MISSING E_LICENSE.
export class BuildError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BuildError';
    this.code = code;
  }
}
