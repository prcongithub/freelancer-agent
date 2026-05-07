FROM ruby:3.4-slim-bookworm

RUN apt-get update -qq && apt-get install -y build-essential libcurl4-openssl-dev libyaml-dev git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

RUN useradd -m -u 1000 app && chown -R app:app /app
USER app

COPY . .

EXPOSE 3000
CMD ["rails", "server", "-b", "0.0.0.0"]
