import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from git import Repo, InvalidGitRepositoryError

BRANCH_COLORS = {
    "main": "#4C8BF5",
    "master": "#4C8BF5",
}
FALLBACK_COLORS = ["#2ECC71", "#E84B3A", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22"]
GHOST_COLOR = "#FFD700"
HEAD_RING_COLOR = "#FFFFFF"
BG_COLOR = "#0D1117"
TEXT_COLOR = "#C9D1D9"
X_SPACING = 1.5
Y_SPACING = -0.7


def get_branch_color(branch_name: str, index: int) -> str:
    return BRANCH_COLORS.get(branch_name, FALLBACK_COLORS[index % len(FALLBACK_COLORS)])


def load_repo(repo_path: str) -> Repo:
    return Repo(repo_path)


def get_commit_graph(repo: Repo) -> list[dict]:
    seen = set()
    commits = []
    for commit in repo.iter_commits("--all"):
        if commit.hexsha in seen:
            continue
        seen.add(commit.hexsha)
        commits.append({
            "sha": commit.hexsha,
            "short_sha": commit.hexsha[:7],
            "message": commit.message.strip().splitlines()[0],
            "parents": [p.hexsha for p in commit.parents],
        })
    return commits


def tag_commits_with_branches(repo: Repo, commits: list[dict]) -> list[dict]:
    sha_to_local: dict[str, list[str]] = {}
    for branch in repo.branches:
        tip = branch.commit.hexsha
        sha_to_local.setdefault(tip, []).append(branch.name)

    sha_to_remote: dict[str, list[str]] = {}
    for remote in repo.remotes:
        for ref in remote.refs:
            if ref.name.endswith("/HEAD"):
                continue
            tip = ref.commit.hexsha
            sha_to_remote.setdefault(tip, []).append(ref.name)

    head_sha = repo.head.commit.hexsha
    for commit in commits:
        commit["local_labels"] = sha_to_local.get(commit["sha"], [])
        commit["remote_labels"] = sha_to_remote.get(commit["sha"], [])
        commit["is_head"] = commit["sha"] == head_sha
    return commits


def assign_lanes(commits: list[dict]) -> dict[str, int]:
    lane_by_sha: dict[str, int] = {}
    active_lanes: list[str | None] = []

    for commit in commits:
        sha = commit["sha"]
        parents = commit["parents"]

        inherited_lane = None
        for parent_sha in parents:
            if parent_sha in lane_by_sha:
                candidate = lane_by_sha[parent_sha]
                if active_lanes[candidate] == parent_sha:
                    inherited_lane = candidate
                    break

        if inherited_lane is not None:
            lane = inherited_lane
        else:
            try:
                lane = active_lanes.index(None)
            except ValueError:
                lane = len(active_lanes)
                active_lanes.append(None)

        lane_by_sha[sha] = lane
        if lane < len(active_lanes):
            active_lanes[lane] = sha
        else:
            active_lanes.append(sha)

    return lane_by_sha


def inject_ghost_node(commits: list[dict], head_sha: str, current_branch: str, message: str) -> list[dict]:
    ghost = {
        "sha": "GHOST_NEXT",
        "short_sha": "next",
        "message": message.strip(),
        "parents": [head_sha],
        "local_labels": [f"← {current_branch} (next)"],
        "remote_labels": [],
        "is_head": False,
    }
    return [ghost] + commits


def build_figure(repo: Repo, commits: list[dict], current_branch: str, next_commit_message: str) -> plt.Figure:
    head_sha = repo.head.commit.hexsha
    ghost_sha = "GHOST_NEXT"

    if next_commit_message.strip():
        commits = inject_ghost_node(commits, head_sha, current_branch, next_commit_message)

    lane_by_sha = assign_lanes(commits)
    sha_to_index = {c["sha"]: i for i, c in enumerate(commits)}

    num_lanes = max(lane_by_sha.values(), default=0) + 1
    fig_width = max(12, 4 + num_lanes * 2)
    fig_height = max(6, len(commits) * 0.6 + 2)

    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)

    def node_position(sha: str) -> tuple[float, float]:
        idx = sha_to_index[sha]
        lane = lane_by_sha[sha]
        return lane * X_SPACING, idx * Y_SPACING

    for commit in commits:
        x_child, y_child = node_position(commit["sha"])
        lane = lane_by_sha[commit["sha"]]
        edge_color = get_branch_color("", lane)

        for parent_sha in commit["parents"]:
            if parent_sha not in sha_to_index:
                continue
            x_parent, y_parent = node_position(parent_sha)
            is_merge = x_child != x_parent
            ax.annotate(
                "",
                xy=(x_parent, y_parent),
                xytext=(x_child, y_child),
                arrowprops=dict(
                    arrowstyle="-|>",
                    color=edge_color,
                    lw=1.8,
                    connectionstyle=f"arc3,rad={'0.3' if is_merge else '0.0'}",
                ),
                zorder=2,
            )

    for commit in commits:
        x, y = node_position(commit["sha"])
        lane = lane_by_sha[commit["sha"]]
        node_color = get_branch_color("", lane)
        is_ghost = commit["sha"] == ghost_sha

        if is_ghost:
            ax.plot(x, y, "o", markersize=13, color=GHOST_COLOR, alpha=0.35, zorder=4)
            ax.plot(x, y, "o", markersize=13, color=GHOST_COLOR, fillstyle="none",
                    markeredgewidth=2, linestyle="--", zorder=5)
        elif commit["is_head"]:
            ax.plot(x, y, "o", markersize=15, color=node_color, zorder=4)
            ax.plot(x, y, "o", markersize=8, color=HEAD_RING_COLOR, zorder=5)
        else:
            ax.plot(x, y, "o", markersize=10, color=node_color, zorder=4)

        label_text = f"{commit['short_sha']}  {commit['message'][:50]}"
        ax.text(x + 0.35, y, label_text, va="center", ha="left",
                fontsize=8, color=TEXT_COLOR, fontfamily="monospace", zorder=6)

        badge_offset_x = x + 0.35
        badge_offset_y = y + 0.22
        for label in commit["local_labels"]:
            badge_bg = "#9E6A03" if label == current_branch else "#238636"
            ax.text(
                badge_offset_x, badge_offset_y,
                f"  {label}  ",
                va="center", ha="left",
                fontsize=7, color="white", fontfamily="monospace",
                bbox=dict(boxstyle="round,pad=0.25", facecolor=badge_bg, edgecolor="none"),
                zorder=7,
            )
            badge_offset_x += len(label) * 0.075 + 0.6
        for label in commit["remote_labels"]:
            ax.text(
                badge_offset_x, badge_offset_y,
                f"  {label}  ",
                va="center", ha="left",
                fontsize=7, color="white", fontfamily="monospace",
                bbox=dict(boxstyle="round,pad=0.25", facecolor="#1F6FEB", edgecolor="none"),
                zorder=7,
            )
            badge_offset_x += len(label) * 0.075 + 0.6

    ax.set_xlim(-0.8, num_lanes * X_SPACING + 6)
    ax.set_ylim(len(commits) * Y_SPACING - 0.8, 0.8)
    ax.set_title("Git Branch Graph", color=TEXT_COLOR, fontsize=12, pad=12)
    ax.axis("off")
    plt.tight_layout()

    return fig


def build_info(repo: Repo, current_branch: str, next_commit_message: str) -> str:
    try:
        head_sha = repo.head.commit.hexsha
    except (TypeError, ValueError):
        head_sha = "N/A (no commits yet)"

    try:
        staged_files = [item.a_path for item in repo.index.diff("HEAD")]
    except (TypeError, ValueError):
        staged_files = []

    untracked = repo.untracked_files
    remote_branches = [
        ref.name for remote in repo.remotes for ref in remote.refs if not ref.name.endswith("/HEAD")
    ]

    info_lines = [
        f"**Current branch:** `{current_branch}`",
        f"**HEAD:** `{head_sha}`",
    ]
    if remote_branches:
        info_lines.append("**Remote branches:** " + ", ".join(f"`{r}`" for r in remote_branches))
    if staged_files:
        info_lines.append("**Staged (ready to commit):** " + ", ".join(f"`{f}`" for f in staged_files))
    if untracked:
        info_lines.append("**Untracked:** " + ", ".join(f"`{f}`" for f in untracked[:5]))
    if next_commit_message.strip():
        info_lines.append(
            f"**Next commit preview:** `{next_commit_message.strip()}`  ← will land on `{current_branch}`"
        )

    return "\n\n".join(info_lines)


def render_branch_graph(repo_path: str, next_commit_message: str) -> tuple[plt.Figure, str]:
    repo = load_repo(repo_path)
    commits = get_commit_graph(repo)
    commits = tag_commits_with_branches(repo, commits)

    try:
        current_branch = repo.active_branch.name if not repo.head.is_detached else "HEAD (detached)"
    except TypeError:
        current_branch = "master (no commits yet)"

    fig = build_figure(repo, commits, current_branch, next_commit_message)
    info = build_info(repo, current_branch, next_commit_message)
    return fig, info
