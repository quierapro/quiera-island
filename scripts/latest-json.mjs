// The updater's manifest for a release (see .github/workflows/release.yml):
// VERSION, SIGNATURE (the installer's .sig) and URL (the installer) come
// from the environment.
const { VERSION, SIGNATURE, URL } = process.env;
if (!VERSION || !SIGNATURE || !URL) {
  console.error("VERSION, SIGNATURE and URL are required");
  process.exit(1);
}
const manifest = {
  version: VERSION,
  notes: `Quiera ${VERSION}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": { signature: SIGNATURE.trim(), url: URL },
  },
};
process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
