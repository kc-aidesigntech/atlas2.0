import SinglePaneWorkspace from './shell/SinglePaneWorkspace'

// Keep the public entry point intentionally small: the workspace module owns shell state,
// overlay routing, and panel mounting while this component remains the stable composer.
export default function SinglePaneApp() {
  return <SinglePaneWorkspace />
}
