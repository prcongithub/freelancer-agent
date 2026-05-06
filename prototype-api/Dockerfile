FROM ruby:3.4.9-slim

RUN apt-get update -qq && apt-get install -y build-essential git libyaml-dev pkg-config && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

COPY . .

EXPOSE 3001
CMD ["rails", "server", "-b", "0.0.0.0", "-p", "3001"]
