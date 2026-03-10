import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import MarketDetailPage from './pages/MarketDetailPage';
import CreateMarketPage from './pages/CreateMarketPage';
import PortfolioPage from './pages/PortfolioPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LendingPage from './pages/LendingPage';
import DocsPage from './pages/DocsPage';

export default function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/market/:id" element={<MarketDetailPage />} />
                <Route path="/create" element={<CreateMarketPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/lending" element={<LendingPage />} />
                <Route path="/docs" element={<DocsPage />} />
            </Routes>
        </Layout>
    );
}
