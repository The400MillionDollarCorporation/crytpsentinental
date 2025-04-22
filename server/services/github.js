// server/services/github.js
import { Octokit } from 'octokit';
import { parse } from 'url';

// Initialize GitHub API client with environment variable
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Parses a GitHub URL to extract username and repository.
 * @param {string} githubUrl - GitHub URL to parse
 * @returns {Object} Object containing type, username, and repo (if available)
 */
function parseGithubUrl(githubUrl) {
  console.log('Parsing GitHub URL:', githubUrl);
  
  try {
    const parsedUrl = parse(githubUrl);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 1) {
      return { type: 'user', username: pathParts[0] };
    } else if (pathParts.length >= 2) {
      return { type: 'repo', username: pathParts[0], repo: pathParts[1] };
    } else {
      throw new Error('Invalid GitHub URL format');
    }
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    throw new Error(`Failed to parse GitHub URL: ${error.message}`);
  }
}

/**
 * Fetches user details and repository metrics.
 * @param {string} username - GitHub username
 * @returns {Object} User metrics including followers, repos, stars, forks
 */
async function fetchUserData(username) {
  console.log('Fetching user data for:', username);
  
  try {
    // Get user details
    const userData = await octokit.rest.users.getByUsername({ username });
    
    // Get repositories (up to 100)
    const reposResponse = await octokit.rest.repos.listForUser({
      username,
      per_page: 100
    });
    
    const repos = reposResponse.data;
    
    // Calculate total stars and forks
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
    
    return {
      followers: userData.data.followers,
      public_repos: userData.data.public_repos,
      total_stars: totalStars,
      total_forks: totalForks,
      repos_count: repos.length
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
}

/**
 * Fetches repository details.
 * @param {string} username - GitHub username
 * @param {string} repo - Repository name
 * @returns {Object} Repository metrics
 */
async function fetchRepoData(username, repo) {
  console.log('Fetching repo data for:', username + '/' + repo);
  
  try {
    const response = await octokit.rest.repos.get({
      owner: username,
      repo
    });
    
    // Get commit activity
    const commitActivity = await octokit.rest.repos.getCommitActivityStats({
      owner: username,
      repo
    });
    
    // Calculate recent commit frequency if available
    let recentCommits = 0;
    if (commitActivity.data && commitActivity.data.length > 0) {
      // Sum the last 4 weeks of commits
      recentCommits = commitActivity.data
        .slice(-4)
        .reduce((sum, week) => sum + week.total, 0);
    }
    
    return {
      stars: response.data.stargazers_count,
      forks: response.data.forks_count,
      watchers: response.data.watchers_count,
      open_issues: response.data.open_issues_count,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      recent_commits: recentCommits
    };
  } catch (error) {
    console.error('Error fetching repo data:', error);
    throw new Error(`Failed to fetch repository data: ${error.message}`);
  }
}

/**
 * Analyzes GitHub repository and returns metrics and an AI-generated rating.
 * @param {string} url - GitHub repository URL
 * @returns {Object} Repository analysis results
 */
async function analyzeGithubRepo(url) {
  try {
    // Parse the GitHub URL
    const parsed = parseGithubUrl(url);
    if (parsed.type !== 'repo') {
      return { error: 'Not a valid repository URL' };
    }
    
    // Get repository data
    const repoData = await fetchRepoData(parsed.username, parsed.repo);
    
    // Get user data for additional context
    const userData = await fetchUserData(parsed.username);
    
    // Combine all data
    const analysis = {
      repository: {
        name: `${parsed.username}/${parsed.repo}`,
        stars: repoData.stars,
        forks: repoData.forks,
        watchers: repoData.watchers,
        open_issues: repoData.open_issues,
        created_at: repoData.created_at,
        updated_at: repoData.updated_at,
        recent_commits: repoData.recent_commits
      },
      developer: {
        username: parsed.username,
        followers: userData.followers,
        public_repos: userData.public_repos,
        total_stars: userData.total_stars,
        total_forks: userData.total_forks
      },
      url: url
    };
    
    return analysis;
    
  } catch (error) {
    console.error('Error analyzing repository:', error);
    return { error: `Failed to analyze repository: ${error.message}` };
  }
}

export {
  parseGithubUrl,
  fetchUserData,
  fetchRepoData,
  analyzeGithubRepo
};