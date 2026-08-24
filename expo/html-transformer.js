const rorkTransformer = require("@rork-ai/toolkit-sdk/metro-transformer");

async function transform(props) {
  if (props.filename.endsWith(".html")) {
    return rorkTransformer.transform({
      ...props,
      src: `module.exports = ${JSON.stringify(props.src)};`,
    });
  }

  return rorkTransformer.transform(props);
}

module.exports = { transform };
