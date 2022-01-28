import { setHandler, sleep } from '@temporalio/workflow'
import { SCRAPE_FREQUENCY } from '../shared'
import ms from 'ms'
import { startScrapingUrlSignal, stopScrapingUrlSignal } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'

const { scrapeUrls: scrapeUrlsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute'
})

interface ScrapeUrlBatchWorkflowPayload {
  batchId: number
}

const log = (message: string, ...rest: Parameters<typeof console.debug>) =>
  console.debug(`scrapeUrlBatchWorkflow: ${message}`, ...rest)

export async function scrapeUrlBatchWorkflow({ batchId }: ScrapeUrlBatchWorkflowPayload) {
  let urls: string[] = []

  // TODO: ensure we never run this handler whilst we're executing the core functionality
  setHandler(startScrapingUrlSignal, async ({ url }) => {
    log('got new url', url)
    urls.push(url)
  })

  // TODO: ensure we never run this handler whilst we're executing the core functionality
  setHandler(stopScrapingUrlSignal, ({ url }) => {
    log('removing url from scrape list', url)

    urls = urls.filter((oldUrl) => oldUrl !== url)

    // TODO: Signal that we have a gap
  })

  const scrapeUrls = async () => {
    if (urls.length === 0) {
      return
    }

    log('running activity to scrape urls', urls)

    await scrapeUrlsActivity({ urls, batchId })
  }

  while (true) {
    await scrapeUrls()

    await sleep(ms(SCRAPE_FREQUENCY))
  }
}
