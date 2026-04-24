// Basic scenarios — single-flow end-to-end coverage.
export { subtitlesUser, subtitlesExpected } from './basic/subtitles-translation/scenario'
export { mediaMixUser, mediaMixExpected } from './basic/media-mix/scenario'
export { singlePdfUser, singlePdfExpected } from './basic/single-pdf/scenario'

// Batch scenarios — multiple files in one conversation.
export { batchTxtUser, batchTxtExpected } from './batch/batch-txt/scenario'
export { batchDocxUser, batchDocxExpected } from './batch/batch-docx/scenario'
export { mixedCategoriesUser, mixedCategoriesExpected } from './batch/mixed-categories/scenario'

// "Something else" scenarios — exercises the free-text userMessage field.
export {
  subtitlesUserMessageUser,
  subtitlesUserMessageExpected,
} from './something-else/subtitles-user-message/scenario'
export {
  targetLanguageAdditionUser,
  targetLanguageAdditionExpected,
} from './something-else/target-language-addition/scenario'
export {
  targetLanguageDistractedQuestionUser,
  targetLanguageDistractedQuestionExpected,
} from './something-else/target-language-distracted-question/scenario'
export {
  userMessageTargetChangeUser,
  userMessageTargetChangeExpected,
} from './something-else/user-message-target-change/scenario'
export {
  userMessageSourceAndTargetChangeUser,
  userMessageSourceAndTargetChangeExpected,
} from './something-else/user-message-source-and-target-change/scenario'
