/**
 * Trigger the global .NET Setup modal from anywhere in the app.
 */
export const openDotnetSetup = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('verity:open-dotnet-setup'));
  }
};
