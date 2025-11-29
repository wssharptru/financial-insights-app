
try {
  console.log("Attempting to require index.js...");
  const index = require('./index.js');
  console.log("Successfully required index.js");
} catch (error) {
  console.error("CRASHED during require:");
  console.error(error);
}
