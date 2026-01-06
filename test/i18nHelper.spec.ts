import { it, describe } from 'mocha';
import { extractChineseFromScript, replaceChineseInTemplate } from '../packages/fileProcessor';
import assert from 'assert';
import { getKeyByText } from '../packages/keyGenerator';

// let index = 0;

// function generateKey(str: string) {
//   const key = `key_${index++}`;
//   return key;
// }

// function __resetKeyIndex() {
//   index = 0
// }

// beforeEach(() => {
//   __resetKeyIndex()
// })

// 模板替换
describe('replaceChineseInTemplate', () => {
  it('attribute', () => {
    const template = `<div title="标题"></div>`
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    assert.equal(result, `<div :title="$t('${getKeyByText('标题', 'common')}')"></div>`);
  });

  it('text', () => {
    const template = `
      <div>
        这是一段文本...
      </div>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    const expectResult = `
      <div>
        {{ $t('${getKeyByText('这是一段文本...', 'common')}') }}
      </div>
    `;
    assert.equal(result, expectResult);
  });

  it('IF', () => {
    const template = `
      <div v-if="condition">
        v-if里的文本
      </div>
      <div v-else>
        v-else里的文本
      </div>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    const expectResult = `
      <div v-if="condition">
        {{ $t('${getKeyByText('v-if里的文本', 'common')}') }}
      </div>
      <div v-else>
        {{ $t('${getKeyByText('v-else里的文本', 'common')}') }}
      </div>
    `;
    assert.equal(result, expectResult);
  });

  it('slot', () => {
    const template = `
      <Parent>
        <template #header>
          <div title="插槽标题">
            插槽文本
          </div>
        </template>
      </Parent>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    const expectResult = `
      <Parent>
        <template #header>
          <div :title="$t('${getKeyByText('插槽标题', 'common')}')">
            {{ $t('${getKeyByText('插槽文本', 'common')}') }}
          </div>
        </template>
      </Parent>
    `;
    assert.equal(result, expectResult);
  })

  it('CompoundExpressionNode', () => {
    const template = `
      <div>
        今天天气{{ weather }}, 温度{{ temperature }}
      </div>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    const expectResult = `
      <div>
        {{ $t('${getKeyByText('今天天气{0}, 温度{1}', 'common')}', { 0: weather, 1: temperature }) }}
      </div>
    `;
    assert.equal(result, expectResult);
  })

  it('not chinese', () => {
    const template = `
      <div title="is a title" desc="is a desc" @click="handleClick">
        {{ name }}
      </div>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    assert.equal(result, template);
  })

  it('complex expression', () => {
    const template = `
      <div>
        {{ status === 1 ? '已完成' : '未完成' }}
      </div>
    `
    const filePath = 'pages/index.vue';
    const result = replaceChineseInTemplate(template, filePath);
    const expectResult = `
      <div>
        {{ status === 1 ? $t('${getKeyByText('已完成', 'common')}') : $t('${getKeyByText('未完成', 'common')}') }}
      </div>
    `;
    assert.equal(result, expectResult);
  })

});

// script
describe('extractChineseFromScript', () => {
  it('var', () => {
    const content = `
      message.error('提交失败');
    `;
    const filePath = 'pages/index.vue';
    const result = extractChineseFromScript(content, filePath);
    const expectResult = `
      message.error(t('${getKeyByText('提交失败', 'common')}'));
    `;
    assert.equal(result, expectResult);
  })

  it('function', () => {
    const content = `
      function getStatus(status) {
        return status === 1 ? '成功' : '失败';
      }
    `
    const filePath = 'pages/index.vue';
    const result = extractChineseFromScript(content, filePath);
    const expectResult = `
      function getStatus(status) {
        return status === 1 ? t('${getKeyByText('成功', 'common')}') : t('${getKeyByText('失败', 'common')}');
      }
    `;
    assert.equal(result, expectResult);
  })
})