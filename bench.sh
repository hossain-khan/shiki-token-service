#!/usr/bin/env bash
set -euo pipefail

HEROKU="https://shiki-token-service-3ab370a7b9cc.herokuapp.com"
WORKERS="https://shiki-token-service.hk-c91.workers.dev"
ITERATIONS=5

SMALL='{"code":"val x = 1","language":"kotlin","theme":"github-dark"}'

MEDIUM='{"code":"package com.example\n\nimport kotlinx.coroutines.*\nimport kotlinx.coroutines.flow.*\n\ndata class User(val name: String, val age: Int)\n\nfun main() = runBlocking {\n    val users = listOf(\n        User(\"Alice\", 30),\n        User(\"Bob\", 25),\n        User(\"Charlie\", 35),\n        User(\"Diana\", 28),\n        User(\"Eve\", 42)\n    )\n\n    val adults = users.filter { it.age >= 30 }\n    adults.forEach { user ->\n        println(\"${user.name} is ${user.age} years old\")\n    }\n\n    val names = users.map { it.name }\n    println(\"All users: ${names.joinToString()}\")\n}","language":"kotlin","theme":"github-dark"}'

LARGE='{"code":"package com.example.service\n\nimport kotlinx.coroutines.*\nimport kotlinx.coroutines.flow.*\nimport kotlinx.serialization.*\nimport kotlinx.serialization.json.*\nimport io.ktor.client.*\nimport io.ktor.client.request.*\nimport io.ktor.client.statement.*\n\n@Serializable\ndata class ApiResponse<T>(\n    val data: T,\n    val status: Int,\n    val message: String,\n    val timestamp: Long = System.currentTimeMillis()\n)\n\n@Serializable\ndata class User(\n    val id: Long,\n    val name: String,\n    val email: String,\n    val roles: List<String> = emptyList()\n)\n\ninterface UserRepository {\n    suspend fun findById(id: Long): User?\n    suspend fun findAll(): List<User>\n    suspend fun save(user: User): User\n    suspend fun delete(id: Long): Boolean\n}\n\nclass UserService(\n    private val repository: UserRepository,\n    private val client: HttpClient,\n    private val dispatcher: CoroutineDispatcher = Dispatchers.IO\n) {\n    suspend fun getUser(id: Long): ApiResponse<User?> = withContext(dispatcher) {\n        val user = repository.findById(id)\n        ApiResponse(\n            data = user,\n            status = if (user != null) 200 else 404,\n            message = if (user != null) \"Found\" else \"Not found\"\n        )\n    }\n\n    suspend fun getAllUsers(): ApiResponse<List<User>> = withContext(dispatcher) {\n        val users = repository.findAll()\n        ApiResponse(data = users, status = 200, message = \"OK\")\n    }\n\n    suspend fun createUser(user: User): ApiResponse<User> = withContext(dispatcher) {\n        require(user.email.contains(\"@\")) { \"Invalid email\" }\n        val saved = repository.save(user)\n        ApiResponse(data = saved, status = 201, message = \"Created\")\n    }\n\n    fun getUserFlow(): Flow<List<User>> = flow {\n        while (true) {\n            emit(repository.findAll())\n            delay(5000)\n        }\n    }.flowOn(dispatcher)\n}","language":"kotlin","theme":"github-dark"}'

SMALL_DUAL='{"code":"val x = 1","language":"kotlin","darkTheme":"github-dark","lightTheme":"github-light"}'
MEDIUM_DUAL='{"code":"package com.example\n\nimport kotlinx.coroutines.*\nimport kotlinx.coroutines.flow.*\n\ndata class User(val name: String, val age: Int)\n\nfun main() = runBlocking {\n    val users = listOf(\n        User(\"Alice\", 30),\n        User(\"Bob\", 25),\n        User(\"Charlie\", 35),\n        User(\"Diana\", 28),\n        User(\"Eve\", 42)\n    )\n\n    val adults = users.filter { it.age >= 30 }\n    adults.forEach { user ->\n        println(\"${user.name} is ${user.age} years old\")\n    }\n\n    val names = users.map { it.name }\n    println(\"All users: ${names.joinToString()}\")\n}","language":"kotlin","darkTheme":"github-dark","lightTheme":"github-light"}'

SMALL_SEM='{"code":"val x = 1","language":"kotlin"}'
MEDIUM_SEM='{"code":"package com.example\n\nimport kotlinx.coroutines.*\nimport kotlinx.coroutines.flow.*\n\ndata class User(val name: String, val age: Int)\n\nfun main() = runBlocking {\n    val users = listOf(\n        User(\"Alice\", 30),\n        User(\"Bob\", 25),\n        User(\"Charlie\", 35),\n        User(\"Diana\", 28),\n        User(\"Eve\", 42)\n    )\n\n    val adults = users.filter { it.age >= 30 }\n    adults.forEach { user ->\n        println(\"${user.name} is ${user.age} years old\")\n    }\n\n    val names = users.map { it.name }\n    println(\"All users: ${names.joinToString()}\")\n}","language":"kotlin"}'

avg_time() {
    local url="$1"
    local payload="$2"
    local total=0
    for i in $(seq 1 "$ITERATIONS"); do
        t=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$url" \
            -H "Content-Type: application/json" -d "$payload")
        total=$(echo "$total + $t" | bc)
    done
    echo "scale=0; ($total * 1000) / $ITERATIONS" | bc
}

echo "=============================================="
echo " Shiki Token Service — Performance Benchmark"
echo " Heroku vs Cloudflare Workers"
echo " Iterations per test: $ITERATIONS"
echo "=============================================="
echo ""

# Warm up both services
echo "Warming up services..."
curl -s -o /dev/null "$HEROKU/health"
curl -s -o /dev/null "$WORKERS/health"
curl -s -o /dev/null -X POST "$HEROKU/highlight" -H "Content-Type: application/json" -d "$SMALL"
curl -s -o /dev/null -X POST "$WORKERS/highlight" -H "Content-Type: application/json" -d "$SMALL"
echo "Done."
echo ""

printf "%-35s %12s %12s %10s\n" "Test" "Heroku (ms)" "Workers (ms)" "Winner"
printf "%-35s %12s %12s %10s\n" "-----------------------------------" "----------" "----------" "--------"

run_test() {
    local label="$1"
    local endpoint="$2"
    local payload="$3"

    h=$(avg_time "$HEROKU$endpoint" "$payload")
    w=$(avg_time "$WORKERS$endpoint" "$payload")

    if [ "$h" -lt "$w" ]; then
        winner="Heroku"
    elif [ "$w" -lt "$h" ]; then
        winner="Workers"
    else
        winner="Tie"
    fi

    printf "%-35s %10s ms %10s ms %10s\n" "$label" "$h" "$w" "$winner"
}

run_test "/highlight small"        "/highlight"          "$SMALL"
run_test "/highlight medium"       "/highlight"          "$MEDIUM"
run_test "/highlight large"        "/highlight"          "$LARGE"
run_test "/highlight/dual small"   "/highlight/dual"     "$SMALL_DUAL"
run_test "/highlight/dual medium"  "/highlight/dual"     "$MEDIUM_DUAL"
run_test "/highlight/semantic sm"  "/highlight/semantic"  "$SMALL_SEM"
run_test "/highlight/semantic md"  "/highlight/semantic"  "$MEDIUM_SEM"

echo ""
echo "Note: Times include network latency (client → server → client)."
echo "      Heroku: US region. Workers: edge (nearest PoP)."
