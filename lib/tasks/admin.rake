namespace :admin do
  desc "Create or update super_admin user. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..."
  task create: :environment do
    email    = ENV.fetch("EMAIL")    { abort "EMAIL is required. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..." }
    password = ENV.fetch("PASSWORD") { abort "PASSWORD is required." }
    name     = ENV.fetch("NAME", "Super Admin")

    user = User.find_or_initialize_by(provider: "local", provider_uid: email.downcase.strip)
    user.assign_attributes(
      role:     "super_admin",
      name:     name,
      email:    email.downcase.strip,
      password: password
    )
    if user.save
      action = user.previously_new_record? ? "created" : "updated"
      puts "Super admin #{action}: #{email}"
    else
      puts "Failed: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  end
end

namespace :user do
  desc "Create or update a freelancer/client user. Usage: rake user:create EMAIL=... PASSWORD=... NAME=... ROLE=freelancer TOKEN=... FREELANCER_USER_ID=..."
  task create: :environment do
    email              = ENV.fetch("EMAIL")    { abort "EMAIL is required." }
    password           = ENV.fetch("PASSWORD") { abort "PASSWORD is required." }
    name               = ENV.fetch("NAME", email.split("@").first.capitalize)
    role               = ENV.fetch("ROLE", "freelancer")
    token              = ENV.fetch("TOKEN", "")
    freelancer_user_id = ENV.fetch("FREELANCER_USER_ID", "")

    abort "ROLE must be freelancer or client" unless %w[freelancer client].include?(role)

    user = User.find_or_initialize_by(provider: "local", provider_uid: email.downcase.strip)
    user.assign_attributes(
      role:               role,
      name:               name,
      email:              email.downcase.strip,
      password:           password,
      oauth_token:        token.presence || user.oauth_token,
      freelancer_user_id: freelancer_user_id.presence || user.freelancer_user_id
    )

    if user.save
      action = user.previously_new_record? ? "created" : "updated"
      puts "User #{action}: #{email} (#{role})"
      puts "Freelancer token: #{token.present? ? 'set' : 'not set'}"
      puts "Freelancer user ID: #{freelancer_user_id.present? ? freelancer_user_id : 'not set'}"
    else
      puts "Failed: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  end
end
