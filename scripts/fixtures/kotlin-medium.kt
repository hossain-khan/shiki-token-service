package dev.hossain.api.routes

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.auth.jwt.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import org.koin.ktor.ext.inject

@Serializable
data class CreateUserRequest(
    val name: String,
    val email: String,
    val role: String = "viewer",
)

@Serializable
data class UpdateUserRequest(
    val name: String? = null,
    val email: String? = null,
    val role: String? = null,
)

@Serializable
data class UserResponse(
    val id: Long,
    val name: String,
    val email: String,
    val role: String,
    val createdAt: String,
)

@Serializable
data class PagedResponse<T>(
    val items: List<T>,
    val total: Long,
    val page: Int,
    val pageSize: Int,
)

fun Route.userRoutes() {
    val userService: UserService by inject()

    route("/users") {
        authenticate("jwt") {
            get {
                val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
                val pageSize = call.request.queryParameters["pageSize"]?.toIntOrNull() ?: 20
                val search = call.request.queryParameters["search"]

                require(page > 0) { "page must be positive" }
                require(pageSize in 1..100) { "pageSize must be between 1 and 100" }

                val result = userService.listUsers(page = page, pageSize = pageSize, search = search)
                call.respond(HttpStatusCode.OK, result)
            }

            get("/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid user id"))

                val user = userService.getUser(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound, mapOf("error" to "User not found"))

                call.respond(HttpStatusCode.OK, user)
            }

            post {
                val principal = call.principal<JWTPrincipal>()
                val callerRole = principal?.getClaim("role", String::class) ?: "viewer"

                if (callerRole != "admin") {
                    return@post call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Admin role required"))
                }

                val body = call.receive<CreateUserRequest>()

                if (body.name.isBlank()) {
                    return@post call.respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to "Name cannot be blank"))
                }
                if (!body.email.contains("@")) {
                    return@post call.respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to "Invalid email address"))
                }

                val created = userService.createUser(body)
                call.respond(HttpStatusCode.Created, created)
            }

            patch("/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid user id"))

                val body = call.receive<UpdateUserRequest>()
                val updated = userService.updateUser(id, body)
                    ?: return@patch call.respond(HttpStatusCode.NotFound, mapOf("error" to "User not found"))

                call.respond(HttpStatusCode.OK, updated)
            }

            delete("/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid user id"))

                val principal = call.principal<JWTPrincipal>()
                val callerRole = principal?.getClaim("role", String::class) ?: "viewer"

                if (callerRole != "admin") {
                    return@delete call.respond(HttpStatusCode.Forbidden, mapOf("error" to "Admin role required"))
                }

                val deleted = userService.deleteUser(id)
                if (!deleted) {
                    return@delete call.respond(HttpStatusCode.NotFound, mapOf("error" to "User not found"))
                }

                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}
