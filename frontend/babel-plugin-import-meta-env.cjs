module.exports = function importMetaEnvPlugin({ types: t }) {
  return {
    name: 'transform-import-meta-env-to-process-env',
    visitor: {
      MemberExpression(path) {
        const { node } = path;
        if (
          t.isMetaProperty(node.object) &&
          t.isIdentifier(node.object.meta, { name: 'import' }) &&
          t.isIdentifier(node.object.property, { name: 'meta' }) &&
          t.isIdentifier(node.property, { name: 'env' })
        ) {
          path.replaceWith(
            t.memberExpression(t.identifier('process'), t.identifier('env'))
          );
        }
      },
    },
  };
};
