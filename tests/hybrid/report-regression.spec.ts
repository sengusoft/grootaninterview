import { test, expect } from '@playwright/test';


test('INTENTIONAL_current_profile_regression_marker', async () => {
  test.skip(process.env.RUN_PROFILE !== 'current', 'only runs for current comparison profile');
  test.skip(
    process.env.INCLUDE_REGRESSION_MARKER !== '1',
    'set INCLUDE_REGRESSION_MARKER=1 (npm run test:current) to record one intentional failure for report comparison',
  );
  test.fail(true, 'Demonstration failing assertion for report comparison (expected to fail)');
  expect(true).toBe(false);
});
