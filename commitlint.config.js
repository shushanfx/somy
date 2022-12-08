// 白名单提交信息前缀
const prefixWhitelist = [
  'Merge branch',
  'merge',
  '[skip ci]',
];

module.exports = {
  extends: [
    '@commitlint/config-conventional',
  ],
  ignores: [
    commit => prefixWhitelist.some(v => commit.startsWith(v)),
  ],
};
