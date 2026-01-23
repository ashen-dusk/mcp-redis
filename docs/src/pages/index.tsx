import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import { Terminal, AnimatedSpan, TypingAnimation } from '../components/Terminal';

import styles from './index.module.css';

const InstallationExample = () => (
  <Terminal>
    <AnimatedSpan delay={0} className={styles.command}>npm install @mcp-ts/redis</AnimatedSpan>
    <TypingAnimation delay={1000} duration={50}>
      Installing dependencies...
    </TypingAnimation>
    <AnimatedSpan delay={2500} className={styles.success}>✓ Package installed successfully</AnimatedSpan>
    <AnimatedSpan delay={3000} className={styles.command}>node server.js</AnimatedSpan>
    <TypingAnimation delay={4000} duration={40}>
      Starting MCP server...
    </TypingAnimation>
    <AnimatedSpan delay={5500} className={styles.success}>🚀 Server ready at http://localhost:3000</AnimatedSpan>
  </Terminal>
);

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--6', styles.heroText)}>
            <Heading as="h1" className="hero__title">
              {siteConfig.title}
            </Heading>
            <p className="hero__subtitle">{siteConfig.tagline}</p>
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                to="/docs/">
                Get Started
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="/docs/api-reference"
                style={{ marginLeft: '1rem', backgroundColor: 'transparent', border: '2px solid white', color: 'white' }}>
                API Reference
              </Link>
            </div>
          </div>
          <div className={clsx('col col--6', styles.heroTerminal)}>
            <InstallationExample />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
