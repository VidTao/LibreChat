import { visit } from 'unist-util-visit';
import type { Pluggable } from 'unified';

/**
 * Remark plugin to parse Lightdash visualization directives
 * Supports:
 * - :::lightdash-chart{url="..." title="..." height="400"}
 * - :::lightdash-dashboard{url="..." title="..." height="600"}
 */
export const lightdashPlugin: Pluggable = () => {
  return (tree) => {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], (node, index, parent) => {
      // Handle other directive types as text
      if (node.type === 'textDirective') {
        const replacementText = `:${node.name}`;
        if (parent && Array.isArray(parent.children) && typeof index === 'number') {
          parent.children[index] = {
            type: 'text',
            value: replacementText,
          };
        }
      }

      // Process lightdash directives
      if (node.name === 'lightdash-chart' || node.name === 'lightdash-dashboard') {
        const visualizationType = node.name.replace('lightdash-', '') as 'chart' | 'dashboard';
        
        // Set the component name and properties for rendering
        node.data = {
          hName: node.name,
          hProperties: {
            ...node.attributes,
            type: visualizationType,
          },
          ...node.data,
        };
        
        return node;
      }
    });
  };
};