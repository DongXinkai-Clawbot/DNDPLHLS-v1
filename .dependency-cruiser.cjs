module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    includeOnly: [
      '^components',
      '^engine',
      '^store',
      '^utils',
      '^hooks',
      '^domain',
      '^data',
      '^App\\.tsx$',
      '^index\\.tsx$',
      '^audioEngine\\.ts$',
      '^midiOut\\.ts$',
      '^musicLogic\\.ts$',
      '^timbreEngine\\.ts$',
      '^types.*\\.ts$',
    ],
    exclude: '(node_modules|dist|android|api|ui_baseline|test-results|docs|scripts)',
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
