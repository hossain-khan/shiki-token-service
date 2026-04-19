import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform")
    id("com.android.library")
    kotlin("plugin.serialization")
    `maven-publish`
}

group = "dev.hossain"
version = "1.0.0"

kotlin {
    androidTarget {
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        publishLibraryVariants("release")
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    jvm {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    sourceSets {
        commonMain.dependencies {
            api("io.ktor:ktor-client-core:3.0.3")          // exposed in ShikiClient public API
            implementation("io.ktor:ktor-client-content-negotiation:3.0.3")
            implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.3")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
        }
        androidMain.dependencies {
            implementation("io.ktor:ktor-client-okhttp:3.0.3")
        }
        jvmMain.dependencies {
            implementation("io.ktor:ktor-client-cio:3.0.3")
        }
    }
}

android {
    namespace = "dev.hossain.shiki"
    compileSdk = 35
    defaultConfig {
        minSdk = 21
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

publishing {
    publications.withType<MavenPublication> {
        pom {
            name.set("Shiki SDK")
            description.set("Kotlin Multiplatform client library for the Shiki Token Service API")
            url.set("https://github.com/hossain-khan/shiki-token-service")
            licenses {
                license {
                    name.set("ISC License")
                    url.set("https://opensource.org/licenses/ISC")
                }
            }
        }
    }
}
