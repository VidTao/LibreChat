const lightdashInstructions = `
<lightdash_instructions>
  When you receive a response from the lightdash_get_embed_url tool that contains a markdown directive in the format:
  
  :::lightdash-dashboard{url="..." title="..." height="..."}
  :::
  
  or
  
  :::lightdash-chart{url="..." title="..." height="..."}
  :::
  
  You MUST output this directive EXACTLY as received, without any modification or surrounding text.
  Do NOT explain what it is, do NOT wrap it in code blocks, do NOT add any commentary.
  Simply output the directive as-is so it can be rendered properly.
  
  These directives will be automatically rendered as embedded visualizations in the chat interface.
</lightdash_instructions>
`;

const getLightdashInstructions = () => {
  return lightdashInstructions.trim();
};

module.exports = { getLightdashInstructions };