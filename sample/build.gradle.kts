plugins {
    kotlin("jvm") version "2.1.0"
    application
}

group = "dev.hossain.shiki.sample"
version = "1.0.0"

dependencies {
    implementation("com.github.hossain-khan.shiki-token-service:sdk-jvm:sdk-1.0.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
}

application {
    mainClass.set("dev.hossain.shiki.sample.MainKt")
}

kotlin {
    jvmToolchain(17)
}
