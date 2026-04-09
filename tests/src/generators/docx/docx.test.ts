import { describe, it } from 'vitest'
import * as path from 'node:path'
import { generateDocx } from './generate'
import type { DocElement } from './types'

const A = path.resolve(__dirname, 'assets')
const O = path.resolve(__dirname, 'output')

const img = {
  noText1: path.join(A, 'image_without_text.png'),
  noText2: path.join(A, 'image_without_text_2.png'),
  withText1: path.join(A, 'image_with_text.png'),
  withText2: path.join(A, 'image_with_text_2.png'),
}

interface TestCase {
  name: string
  elements: DocElement[]
}

const cases: TestCase[] = [
  {
    name: '01-text-only-greeting',
    elements: [
      { type: 'text', value: 'Welcome to our annual report for this year.' },
    ],
  },
  {
    name: '02-single-image',
    elements: [
      { type: 'asset', path: img.noText1, width: 500, height: 350 },
    ],
  },
  {
    name: '03-text-then-image',
    elements: [
      { type: 'text', value: 'Below you can see the main dashboard overview.' },
      { type: 'asset', path: img.withText1, width: 400, height: 280 },
    ],
  },
  {
    name: '04-image-then-text',
    elements: [
      { type: 'asset', path: img.noText2, width: 350, height: 250 },
      { type: 'text', value: 'The chart above shows quarterly revenue growth.' },
    ],
  },
  {
    name: '05-sandwich-text-image-text',
    elements: [
      { type: 'text', value: 'Project summary for Q3 results.' },
      { type: 'asset', path: img.withText2, width: 450, height: 300 },
      { type: 'text', value: 'Key takeaways are listed below.' },
    ],
  },
  {
    name: '06-two-images-no-text',
    elements: [
      { type: 'asset', path: img.noText1, width: 400, height: 300 },
      { type: 'asset', path: img.withText1, width: 400, height: 300 },
    ],
  },
  {
    name: '07-alternating-text-image',
    elements: [
      { type: 'text', value: 'Introduction to the design system.' },
      { type: 'asset', path: img.noText2, width: 500, height: 340 },
      { type: 'text', value: 'Component library details follow.' },
      { type: 'asset', path: img.withText2, width: 500, height: 340 },
    ],
  },
  {
    name: '08-three-paragraphs',
    elements: [
      { type: 'text', value: 'The server migration is complete.' },
      { type: 'text', value: 'All services have been verified and tested.' },
      { type: 'text', value: 'No downtime was recorded during the process.' },
    ],
  },
  {
    name: '09-image-between-texts',
    elements: [
      { type: 'text', value: 'Performance benchmarks are shown here.' },
      { type: 'asset', path: img.noText1, width: 600, height: 400 },
      { type: 'text', value: 'Results exceeded our initial expectations significantly.' },
    ],
  },
  {
    name: '10-all-four-images',
    elements: [
      { type: 'asset', path: img.noText1, width: 300, height: 200 },
      { type: 'asset', path: img.noText2, width: 300, height: 200 },
      { type: 'asset', path: img.withText1, width: 300, height: 200 },
      { type: 'asset', path: img.withText2, width: 300, height: 200 },
    ],
  },
  {
    name: '11-short-note',
    elements: [
      { type: 'text', value: 'Quick note: deployment scheduled for Friday.' },
    ],
  },
  {
    name: '12-wide-image-with-caption',
    elements: [
      { type: 'asset', path: img.noText1, width: 700, height: 200 },
      { type: 'text', value: 'Figure 1: Network topology overview.' },
    ],
  },
  {
    name: '13-small-image-with-description',
    elements: [
      { type: 'text', value: 'Team photo from the offsite event last month.' },
      { type: 'asset', path: img.noText2, width: 200, height: 150 },
    ],
  },
  {
    name: '14-text-heavy-with-one-image',
    elements: [
      { type: 'text', value: 'We completed the security audit successfully.' },
      { type: 'text', value: 'All critical vulnerabilities have been patched.' },
      { type: 'asset', path: img.withText1, width: 450, height: 320 },
      { type: 'text', value: 'Full report is attached separately.' },
    ],
  },
  {
    name: '15-image-gallery-with-intro',
    elements: [
      { type: 'text', value: 'Screenshot gallery from the latest build.' },
      { type: 'asset', path: img.noText1, width: 350, height: 250 },
      { type: 'asset', path: img.withText2, width: 350, height: 250 },
      { type: 'asset', path: img.noText2, width: 350, height: 250 },
    ],
  },
  {
    name: '16-single-sentence',
    elements: [
      { type: 'text', value: 'Access credentials have been rotated.' },
    ],
  },
  {
    name: '17-two-texts-one-image',
    elements: [
      { type: 'text', value: 'Sprint review highlights for this iteration.' },
      { type: 'text', value: 'Velocity improved by twelve percent overall.' },
      { type: 'asset', path: img.withText1, width: 500, height: 350 },
    ],
  },
  {
    name: '18-image-text-image',
    elements: [
      { type: 'asset', path: img.withText2, width: 400, height: 280 },
      { type: 'text', value: 'Comparison between old and new layouts.' },
      { type: 'asset', path: img.noText1, width: 400, height: 280 },
    ],
  },
  {
    name: '19-tall-image',
    elements: [
      { type: 'text', value: 'Mobile screenshot captured on latest firmware.' },
      { type: 'asset', path: img.noText2, width: 250, height: 500 },
    ],
  },
  {
    name: '20-mixed-five-elements',
    elements: [
      { type: 'text', value: 'Database schema changes are documented here.' },
      { type: 'asset', path: img.withText1, width: 450, height: 300 },
      { type: 'text', value: 'Migration scripts were tested thoroughly.' },
      { type: 'asset', path: img.noText2, width: 450, height: 300 },
      { type: 'text', value: 'Rollback plan is ready if needed.' },
    ],
  },
  {
    name: '21-bulletin-style',
    elements: [
      { type: 'text', value: 'Monthly engineering update: April edition.' },
      { type: 'asset', path: img.noText1, width: 550, height: 380 },
    ],
  },
  {
    name: '22-closing-remark',
    elements: [
      { type: 'asset', path: img.withText2, width: 500, height: 350 },
      { type: 'text', value: 'Thank you for reviewing this document.' },
    ],
  },
  {
    name: '23-two-images-with-separator-text',
    elements: [
      { type: 'asset', path: img.noText1, width: 400, height: 280 },
      { type: 'text', value: 'Before and after optimization results.' },
      { type: 'asset', path: img.noText2, width: 400, height: 280 },
    ],
  },
  {
    name: '24-question-format',
    elements: [
      { type: 'text', value: 'What improvements can we expect next quarter?' },
      { type: 'asset', path: img.withText1, width: 480, height: 330 },
    ],
  },
  {
    name: '25-three-images-footer',
    elements: [
      { type: 'asset', path: img.noText1, width: 300, height: 200 },
      { type: 'asset', path: img.withText1, width: 300, height: 200 },
      { type: 'asset', path: img.noText2, width: 300, height: 200 },
      { type: 'text', value: 'End of visual comparison section.' },
    ],
  },
  {
    name: '26-plain-announcement',
    elements: [
      { type: 'text', value: 'Office closed next Monday for maintenance.' },
    ],
  },
  {
    name: '27-annotated-screenshot',
    elements: [
      { type: 'text', value: 'Error dialog shown after login timeout.' },
      { type: 'asset', path: img.withText2, width: 550, height: 400 },
      { type: 'text', value: 'This occurs only on slow connections.' },
    ],
  },
  {
    name: '28-large-image-only',
    elements: [
      { type: 'asset', path: img.noText1, width: 800, height: 600 },
    ],
  },
  {
    name: '29-header-image-body',
    elements: [
      { type: 'text', value: 'Release notes version three point five.' },
      { type: 'asset', path: img.withText1, width: 500, height: 100 },
      { type: 'text', value: 'Bug fixes and feature improvements included.' },
    ],
  },
  {
    name: '30-four-texts',
    elements: [
      { type: 'text', value: 'Step one: open the configuration panel.' },
      { type: 'text', value: 'Step two: select the target environment.' },
      { type: 'text', value: 'Step three: apply the changes.' },
      { type: 'text', value: 'Step four: verify the deployment status.' },
    ],
  },
  {
    name: '31-image-pair-with-texts',
    elements: [
      { type: 'text', value: 'Desktop view shown first.' },
      { type: 'asset', path: img.noText1, width: 500, height: 350 },
      { type: 'text', value: 'Mobile view shown second.' },
      { type: 'asset', path: img.noText2, width: 250, height: 450 },
    ],
  },
  {
    name: '32-compact-memo',
    elements: [
      { type: 'text', value: 'Reminder: code freeze starts Wednesday evening.' },
      { type: 'asset', path: img.withText2, width: 350, height: 250 },
    ],
  },
  {
    name: '33-triple-image-row',
    elements: [
      { type: 'asset', path: img.withText1, width: 250, height: 180 },
      { type: 'asset', path: img.noText1, width: 250, height: 180 },
      { type: 'asset', path: img.withText2, width: 250, height: 180 },
    ],
  },
  {
    name: '34-image-footer-text',
    elements: [
      { type: 'asset', path: img.noText2, width: 600, height: 420 },
      { type: 'text', value: 'Source: internal monitoring dashboard.' },
    ],
  },
  {
    name: '35-two-texts-two-images',
    elements: [
      { type: 'text', value: 'API response times improved after caching.' },
      { type: 'asset', path: img.withText1, width: 450, height: 300 },
      { type: 'text', value: 'Memory usage remained stable throughout testing.' },
      { type: 'asset', path: img.noText1, width: 450, height: 300 },
    ],
  },
  {
    name: '36-minimal-text',
    elements: [
      { type: 'text', value: 'Done.' },
    ],
  },
  {
    name: '37-image-sandwich-double',
    elements: [
      { type: 'asset', path: img.noText2, width: 400, height: 280 },
      { type: 'text', value: 'Transition between phases is seamless.' },
      { type: 'asset', path: img.withText2, width: 400, height: 280 },
      { type: 'text', value: 'Final state matches the expected output.' },
      { type: 'asset', path: img.noText1, width: 400, height: 280 },
    ],
  },
  {
    name: '38-status-update',
    elements: [
      { type: 'text', value: 'Build status: all checks passed successfully.' },
      { type: 'asset', path: img.withText1, width: 500, height: 100 },
    ],
  },
  {
    name: '39-tiny-image-big-text',
    elements: [
      { type: 'text', value: 'The icon set was redesigned for better clarity.' },
      { type: 'asset', path: img.withText2, width: 100, height: 100 },
      { type: 'text', value: 'Each icon now supports dark mode natively.' },
    ],
  },
  {
    name: '40-full-page-image',
    elements: [
      { type: 'text', value: 'Full page layout preview below.' },
      { type: 'asset', path: img.noText1, width: 700, height: 900 },
    ],
  },
  {
    name: '41-alternating-all-images',
    elements: [
      { type: 'text', value: 'Visual comparison across all variants.' },
      { type: 'asset', path: img.noText1, width: 350, height: 240 },
      { type: 'text', value: 'Second variant with annotations.' },
      { type: 'asset', path: img.withText1, width: 350, height: 240 },
      { type: 'text', value: 'Third variant without labels.' },
      { type: 'asset', path: img.noText2, width: 350, height: 240 },
    ],
  },
  {
    name: '42-event-invitation',
    elements: [
      { type: 'text', value: 'You are invited to the product launch event.' },
      { type: 'asset', path: img.withText2, width: 550, height: 380 },
    ],
  },
  {
    name: '43-only-captioned-images',
    elements: [
      { type: 'asset', path: img.noText1, width: 400, height: 280 },
      { type: 'text', value: 'Figure A.' },
      { type: 'asset', path: img.noText2, width: 400, height: 280 },
      { type: 'text', value: 'Figure B.' },
    ],
  },
  {
    name: '44-warning-notice',
    elements: [
      { type: 'text', value: 'Warning: this environment uses production data.' },
      { type: 'asset', path: img.withText1, width: 500, height: 350 },
      { type: 'text', value: 'Handle with care and follow security protocols.' },
    ],
  },
  {
    name: '45-single-image-with-text',
    elements: [
      { type: 'asset', path: img.withText2, width: 600, height: 420 },
    ],
  },
  {
    name: '46-feedback-summary',
    elements: [
      { type: 'text', value: 'User feedback collected from beta testers.' },
      { type: 'text', value: 'Overall satisfaction score was eight out of ten.' },
      { type: 'asset', path: img.noText2, width: 500, height: 350 },
    ],
  },
  {
    name: '47-changelog-entry',
    elements: [
      { type: 'text', value: 'Fixed navigation bug on tablet devices.' },
      { type: 'asset', path: img.withText1, width: 400, height: 280 },
      { type: 'text', value: 'Improved loading speed for image galleries.' },
      { type: 'asset', path: img.noText1, width: 400, height: 280 },
      { type: 'text', value: 'Added dark mode toggle in settings.' },
    ],
  },
  {
    name: '48-image-heavy-six',
    elements: [
      { type: 'asset', path: img.noText1, width: 280, height: 200 },
      { type: 'asset', path: img.withText1, width: 280, height: 200 },
      { type: 'asset', path: img.noText2, width: 280, height: 200 },
      { type: 'asset', path: img.withText2, width: 280, height: 200 },
      { type: 'asset', path: img.noText1, width: 280, height: 200 },
      { type: 'asset', path: img.withText1, width: 280, height: 200 },
    ],
  },
  {
    name: '49-mixed-long',
    elements: [
      { type: 'text', value: 'Architecture review document.' },
      { type: 'asset', path: img.noText1, width: 500, height: 350 },
      { type: 'asset', path: img.withText2, width: 500, height: 350 },
      { type: 'text', value: 'Both diagrams show the proposed structure.' },
      { type: 'asset', path: img.noText2, width: 500, height: 350 },
      { type: 'text', value: 'Final approval pending from the tech lead.' },
    ],
  },
  {
    name: '50-sign-off',
    elements: [
      { type: 'text', value: 'This concludes the document. Thank you.' },
      { type: 'asset', path: img.withText2, width: 200, height: 60 },
    ],
  },
]

describe('DOCX Generation', () => {
  for (const tc of cases) {
    it(tc.name, async () => {
      await generateDocx({
        title: tc.name,
        elements: tc.elements,
        outputPath: path.join(O, `${tc.name}.docx`),
      })
    })
  }
})
