package dev.hossain.data.repository

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

@Serializable
data class Project(
    val id: Long,
    val name: String,
    val description: String,
    val ownerId: Long,
    val status: ProjectStatus,
    val visibility: Visibility,
    val tags: List<String> = emptyList(),
    val createdAt: Long = Instant.now().epochSecond,
    val updatedAt: Long = Instant.now().epochSecond,
)

@Serializable
enum class ProjectStatus { ACTIVE, ARCHIVED, DELETED }

@Serializable
enum class Visibility { PUBLIC, PRIVATE, INTERNAL }

data class ProjectFilter(
    val ownerId: Long? = null,
    val status: ProjectStatus? = null,
    val visibility: Visibility? = null,
    val tag: String? = null,
    val nameContains: String? = null,
)

data class Page<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val pageSize: Int,
    val hasNext: Boolean = (page * pageSize) < total,
)

interface ProjectRepository {
    suspend fun findById(id: Long): Project?
    suspend fun findAll(filter: ProjectFilter, page: Int, pageSize: Int): Page<Project>
    suspend fun save(project: Project): Project
    suspend fun update(id: Long, update: ProjectUpdate): Project?
    suspend fun delete(id: Long): Boolean
    fun observeByOwner(ownerId: Long): Flow<List<Project>>
}

data class ProjectUpdate(
    val name: String? = null,
    val description: String? = null,
    val status: ProjectStatus? = null,
    val visibility: Visibility? = null,
    val tags: List<String>? = null,
)

class InMemoryProjectRepository(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) : ProjectRepository {
    private val store = ConcurrentHashMap<Long, Project>()
    private var nextId = 1L

    override suspend fun findById(id: Long): Project? = withContext(dispatcher) {
        store[id]
    }

    override suspend fun findAll(filter: ProjectFilter, page: Int, pageSize: Int): Page<Project> =
        withContext(dispatcher) {
            var sequence = store.values.asSequence()

            filter.ownerId?.let { oid -> sequence = sequence.filter { it.ownerId == oid } }
            filter.status?.let { s -> sequence = sequence.filter { it.status == s } }
            filter.visibility?.let { v -> sequence = sequence.filter { it.visibility == v } }
            filter.tag?.let { t -> sequence = sequence.filter { t in it.tags } }
            filter.nameContains?.let { n ->
                sequence = sequence.filter { it.name.contains(n, ignoreCase = true) }
            }

            val all = sequence.toList()
            val total = all.size.toLong()
            val from = ((page - 1) * pageSize).coerceAtMost(all.size)
            val to = (from + pageSize).coerceAtMost(all.size)
            Page(items = all.subList(from, to), total = total, page = page, pageSize = pageSize)
        }

    override suspend fun save(project: Project): Project = withContext(dispatcher) {
        val toSave = project.copy(id = nextId++)
        store[toSave.id] = toSave
        toSave
    }

    override suspend fun update(id: Long, update: ProjectUpdate): Project? = withContext(dispatcher) {
        val existing = store[id] ?: return@withContext null
        val updated = existing.copy(
            name = update.name ?: existing.name,
            description = update.description ?: existing.description,
            status = update.status ?: existing.status,
            visibility = update.visibility ?: existing.visibility,
            tags = update.tags ?: existing.tags,
            updatedAt = Instant.now().epochSecond,
        )
        store[id] = updated
        updated
    }

    override suspend fun delete(id: Long): Boolean = withContext(dispatcher) {
        store.remove(id) != null
    }

    override fun observeByOwner(ownerId: Long): Flow<List<Project>> = flow {
        while (true) {
            val projects = store.values.filter { it.ownerId == ownerId }
            emit(projects)
            kotlinx.coroutines.delay(2_000)
        }
    }.flowOn(dispatcher)
}

class ProjectService(
    private val repository: ProjectRepository,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    suspend fun getProject(id: Long): Result<Project> = runCatching {
        repository.findById(id) ?: error("Project $id not found")
    }

    suspend fun listProjects(
        filter: ProjectFilter = ProjectFilter(),
        page: Int = 1,
        pageSize: Int = 20,
    ): Result<Page<Project>> = runCatching {
        require(page > 0) { "page must be positive" }
        require(pageSize in 1..100) { "pageSize must be between 1 and 100" }
        repository.findAll(filter, page, pageSize)
    }

    suspend fun createProject(
        name: String,
        description: String,
        ownerId: Long,
        visibility: Visibility = Visibility.PRIVATE,
        tags: List<String> = emptyList(),
    ): Result<Project> = runCatching {
        require(name.isNotBlank()) { "Project name cannot be blank" }
        require(description.length <= 500) { "Description exceeds 500 characters" }
        val project = Project(
            id = 0L,
            name = name.trim(),
            description = description.trim(),
            ownerId = ownerId,
            status = ProjectStatus.ACTIVE,
            visibility = visibility,
            tags = tags.map { it.lowercase().trim() }.distinct(),
        )
        repository.save(project)
    }

    suspend fun archiveProject(id: Long, requesterId: Long): Result<Project> = runCatching {
        val project = repository.findById(id) ?: error("Project $id not found")
        require(project.ownerId == requesterId) { "Only the owner can archive this project" }
        require(project.status == ProjectStatus.ACTIVE) { "Project is not active" }
        repository.update(id, ProjectUpdate(status = ProjectStatus.ARCHIVED))
            ?: error("Failed to archive project $id")
    }

    suspend fun deleteProject(id: Long, requesterId: Long): Result<Boolean> = runCatching {
        val project = repository.findById(id) ?: error("Project $id not found")
        require(project.ownerId == requesterId) { "Only the owner can delete this project" }
        repository.delete(id)
    }

    fun streamOwnerProjects(ownerId: Long): Flow<List<Project>> =
        repository.observeByOwner(ownerId)
}

// Extension helpers

fun Project.isAccessibleBy(userId: Long): Boolean =
    visibility == Visibility.PUBLIC ||
        ownerId == userId ||
        visibility == Visibility.INTERNAL

fun List<Project>.activeOnly(): List<Project> = filter { it.status == ProjectStatus.ACTIVE }

fun Page<Project>.mapItems(transform: (Project) -> Project): Page<Project> =
    copy(items = items.map(transform))
