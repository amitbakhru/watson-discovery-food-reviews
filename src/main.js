/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import 'isomorphic-fetch';
import React from 'react';
import PropTypes from 'prop-types';
import queryString from 'query-string';
import Matches from './Matches';
import PaginationMenu from './PaginationMenu';
import EntitiesFilter from './EntitiesFilter';
import CategoriesFilter from './CategoriesFilter';
import ConceptsFilter from './ConceptsFilter';
import KeywordsFilter from './KeywordsFilter';
import EntityTypesFilter from './EntityTypesFilter';
import TrendChart from './TrendChart';
import SentimentChart from './SentimentChart';
import { Grid, Dimmer, Button, Menu, Dropdown, Divider, Loader, Accordion, Icon, Header, Statistic } from 'semantic-ui-react';
const utils = require('../lib/utils');
//const util = require('util');

/**
 * Main React object that contains all objects on the web page.
 * This object manages all interaction between child objects as
 * well as making search requests to the discovery service.
 */
class Main extends React.Component {
  constructor(...props) {
    super(...props);
    const { 
      // query data
      products,
      reviewers,
      entities, 
      categories, 
      concepts, 
      keywords,
      entityTypes,
      data,
      numMatches,
      numPositive,
      numNeutral,
      numNegative,
      error,
      // query params
      searchQuery,
      sentimentFilter,
      productIdFilter,
      reviewerIdFilter,
      sortOrder,
      // for filters
      selectedEntities,
      selectedCategories,
      selectedConcepts,
      selectedKeywords,
      selectedEntityTypes,
      // matches panel
      currentPage,
      // trending chart
      trendData,
      trendError,
      trendTerm,
      // sentiment chart
      sentimentTerm
    } = this.props;

    // change in state fires re-render of components
    this.state = {
      // query data
      products: products && parseProducts(products),
      reviewers: reviewers && parseReviewers(reviewers),
      entities: entities && parseEntities(entities),
      categories: categories && parseCategories(categories),
      concepts: concepts && parseConcepts(concepts),
      keywords: keywords && parseKeywords(keywords),
      entityTypes: entityTypes && parseEntityTypes(entityTypes),
      data: data,   // data should already be formatted
      numMatches: numMatches || 0,
      numPositive: numPositive || 0,
      numNeutral: numNeutral || 0,
      numNegative: numNegative || 0,
      loading: false,
      error: error,
      // query params
      searchQuery: searchQuery || '',
      sortOrder: sortOrder || utils.sortKeys[0].sortBy,
      sentimentFilter: sentimentFilter || 'ALL',
      productIdFilter: productIdFilter || 'ALL',
      reviewerIdFilter: reviewerIdFilter || 'ALL',
      // used by filters
      selectedEntities: selectedEntities || new Set(),
      selectedCategories: selectedCategories || new Set(),
      selectedConcepts: selectedConcepts || new Set(),
      selectedKeywords: selectedKeywords || new Set(),
      selectedEntityTypes: selectedEntityTypes || new Set(),
      // trending chart
      trendData: trendData || null,
      trendError: trendError,
      trendTerm: trendTerm || utils.TRENDING_TERM_ITEM,
      trendLoading: false,
      // sentiment chart
      sentimentTerm: sentimentTerm || utils.SENTIMENT_TERM_ITEM,
      // misc panel
      currentPage: currentPage || '1',  // which page of matches are we showing
      activeFilterIndex: utils.SENTIMENT_DATA_INDEX, // which filter index is expanded/active
    };
  }

  /**
   * handleAccordionClick - (callback function)
   * User has selected one of the 
   * filter boxes to expand and show values for.
   */
  handleAccordionClick(e, titleProps) {
    const { index } = titleProps;
    const { activeFilterIndex } = this.state;
    const newIndex = activeFilterIndex === index ? -1 : index;
    this.setState({ activeFilterIndex: newIndex });
  }

  /**
   * filtersChanged - (callback function)
   * User has selected one of the values from within
   * of the filter boxes. This results in making a new qeury to 
   * the disco service.
   */
  filtersChanged() {
    const { searchQuery  } = this.state;
    this.fetchData(searchQuery, false);
  }

  /**
   * handleClearAllFiltersClick - (callback function)
   * User has selected button to clear out all filters.
   * This results in making a new qeury to the disco
   * service with no filters turned on.
   */
  handleClearAllFiltersClick() {
    const { searchQuery  } = this.state;
    this.fetchData(searchQuery, true);
  }

  /**
   * pageChanged - (callback function)
   * User has selected a new page of results to display.
   */
  pageChanged(data) {
    this.setState({ currentPage: data.currentPage });
  }

  /**
   * searchQueryChanged - (callback function)
   * User has entered a new search string to query on. 
   * This results in making a new qeury to the disco service.
   */
  searchQueryChanged(query) {
    const { searchQuery } = query;
    console.log('searchQuery [FROM SEARCH]: ' + searchQuery);
   
    // true = clear all filters for new search
    this.fetchData(searchQuery, true);
  }

  applySentimentFilter(event, data) {
    this.setState({ sentimentFilter: data.value });
  }
  
  applyProductIdFilter(event, data) {
    this.setState({ productIdFilter: data.value });
  }

  applyReviewerIdFilter(event, data) {
    this.setState({ reviewerIdFilter: data.value });
  }

  componentDidUpdate(prevProps, prevState) {
    const { searchQuery, sentimentFilter, productIdFilter, reviewerIdFilter } = this.state;
    if ((sentimentFilter != prevState.sentimentFilter) || 
        (productIdFilter != prevState.productIdFilter) ||
        (reviewerIdFilter != prevState.reviewerIdFilter)) {
      // true = clear all filters for new search
      this.fetchData(searchQuery, true);
    }
  }

  /**
   * sentimentTermChanged - (callback function)
   * User has selected a new term to use in the sentiment
   * chart. Keep track of this so that main stays in sync.
   */
  sentimentTermChanged(data) {
    const { term } = data;
    this.setState({ sentimentTerm: term });
  }

  /**
   * sortOrderChange - (callback function)
   * User has changed how to sort the matches (defaut
   * is by highest score first). Save the value for
   * all subsequent queries to discovery.
   */
  sortOrderChange(event, selection) {
    const { data, sortOrder } = this.state;
    console.log('sortOrder: ' + sortOrder);
    if (sortOrder != selection.value) {

      // get internal version of the sort key
      var sortKey = '';
      for (var i=0; i<utils.sortKeys.length; i++) {
        if (utils.sortKeys[i].sortBy === selection.value) {
          sortKey = utils.sortKeys[i].sortBy;
          break;
        }
      }
      data.results = this.sortData(data, sortKey);

      // save off external key in case we do another query to Discovery
      this.setState({
        data: data,
        sortOrder: selection.value
      });
    }
  }

  sortData(data, sortKey) {
    var sortedData = data.results.slice();
    var sortBy = require('sort-by');
    
    sortedData.sort(sortBy(sortKey));
    return sortedData;
  }

  /**
   * tagItemSelected - (callback function)
   * User has selected an item from the tag cloud object
   * to filter on. This results in making a new qeury to the 
   * disco service.
   */
  tagItemSelected(tag) {
    var { selectedTagValue, cloudType } = tag;
    console.log('tagValue [FROM TAG CLOUD]: ' + selectedTagValue);

    // manually add this item to the list of selected items
    // based on filter type. This is needed so that both the 
    // tag cloud and the filter objects stay in sync (both 
    // reflect what items have been selected).
    const { entities, selectedEntities, 
      categories, selectedCategories, 
      concepts, selectedConcepts,
      keywords, selectedKeywords,
      entityTypes, selectedEntityTypes,
      searchQuery  } = this.state;

    if (cloudType === utils.CATEGORY_FILTER) {
      var fullName = this.buildFullTagName(selectedTagValue, categories.results);
      if (selectedCategories.has(fullName)) {
        selectedCategories.delete(fullName);
      } else {
        selectedCategories.add(fullName);
      }
      this.setState({
        selectedCategories: selectedCategories
      });

    } else if (cloudType == utils.CONCEPT_FILTER) {
      fullName = this.buildFullTagName(selectedTagValue, concepts.results);
      if (selectedConcepts.has(fullName)) {
        selectedConcepts.delete(fullName);
      } else {
        selectedConcepts.add(fullName);
      }
      this.setState({
        selectedConcepts: selectedConcepts
      });

    } else if (cloudType == utils.KEYWORD_FILTER) {
      fullName = this.buildFullTagName(selectedTagValue, keywords.results);
      if (selectedKeywords.has(fullName)) {
        selectedKeywords.delete(fullName);
      } else {
        selectedKeywords.add(fullName);
      }
      this.setState({
        selectedKeywords: selectedKeywords
      });

    } else if (cloudType == utils.ENTITIY_FILTER) {
      fullName = this.buildFullTagName(selectedTagValue, entities.results);
      if (selectedEntities.has(fullName)) {
        selectedEntities.delete(fullName);
      } else {
        selectedEntities.add(fullName);
      }
      this.setState({
        selectedEntities: selectedEntities
      });

    } else if (cloudType == utils.ENTITY_TYPE_FILTER) {
      fullName = this.buildFullTagName(selectedTagValue, entityTypes.results);
      if (selectedEntityTypes.has(fullName)) {
        selectedEntityTypes.delete(fullName);
      } else {
        selectedEntityTypes.add(fullName);
      }
      this.setState({
        selectedEntityTypes: selectedEntityTypes
      });
    }

    // execute new search w/ filters
    this.fetchData(searchQuery, false);
  }

  /**
   * getTrendData - (callback function)
   * User has entered a new search string to query on. 
   * This results in making a new qeury to the disco service.
   * Keep track of the current term value so that main stays
   * in sync with the trending chart component.
   * 
   * NOTE: This function is also called at startup to 
   * display a default graph.
   */
  getTrendData(data) {
    var { chartType, term } = data;

    // we don't have any data to show for "all" items, so just clear chart
    if (term === utils.TRENDING_TERM_ITEM) {
      this.setState(
        { 
          trendData: null,
          trendLoading: false,
          trendError: null,
          trendTerm: term
        });
      return;
    } 
    
    this.setState({
      trendLoading: true,
      trendTerm: term
    });

    // build query string, with based on filter type
    var trendQuery = '';
    if (chartType === utils.ENTITIY_FILTER) {
      trendQuery = 'enriched_text.entities.text::' + term;
    } else if (chartType === utils.CATEGORY_FILTER) {
      trendQuery = 'enriched_text.categories.label::' + term;
    } else if (chartType === utils.CONCEPT_FILTER) {
      trendQuery = 'enriched_text.concepts.text::' + term;
    } else if (chartType === utils.KEYWORD_FILTER) {
      trendQuery = 'enriched_text.keywords.text::' + term;
    } else if (chartType === utils.ENTITY_TYPE_FILTER) {
      trendQuery = 'enriched_text.entities.type::' + term;
    }

    const qs = queryString.stringify({
      query: trendQuery,
      filters: this.buildFilterStringForQuery(),
      count: 2000
    });

    // send request
    fetch(`/api/trending?${qs}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw response;
        }
      })
      .then(json => {
        // const util = require('util');
        console.log('+++ DISCO TREND RESULTS +++');
        // console.log(util.inspect(json.aggregations[0].results, false, null));
        console.log('numMatches: ' + json.matching_results);
      
        this.setState({ 
          trendData: json,
          trendLoading: false,
          trendError: null,
          trendTerm: term
        });
      })
      .catch(response => {
        this.setState({
          trendError: (response.status === 429) ? 'Number of free queries per month exceeded' : 'Error fetching results',
          trendLoading: false,
          trendData: null,
          trendTerm: utils.TRENDING_TERM_ITEM
        });
        // eslint-disable-next-line no-console
        console.error(response);
      });
  }
  
  /**
   * fetchData - build the query that will be passed to the 
   * discovery service.
   */
  fetchData(query, clearFilters) {
    const searchQuery = query;
    var {
      selectedEntities, 
      selectedCategories, 
      selectedConcepts,
      selectedKeywords,
      selectedEntityTypes,
      sortOrder,
    } = this.state;

    // clear filters if this a new text search
    if (clearFilters) {
      selectedEntities.clear();
      selectedCategories.clear();
      selectedConcepts.clear();
      selectedKeywords.clear();
      selectedEntityTypes.clear();
    }

    // console.log("QUERY2 - selectedCategories: ");
    // for (let item of selectedCategories)
    //   console.log(util.inspect(item, false, null));
    // console.log("QUERY2 - searchQuery: " + searchQuery);
    
    this.setState({
      loading: true,
      currentPage: '1',
      searchQuery
    });

    scrollToMain();
    history.pushState({}, {}, `/${searchQuery.replace(/ /g, '+')}`);
    const filterString = this.buildFilterStringForQuery();

    // build query string, with filters and optional params
    const qs = queryString.stringify({
      query: searchQuery,
      filters: filterString,
      count: 2000,
      // sort: sortOrder,
      queryType: 'natural_language_query'
    });

    // send request
    fetch(`/api/search?${qs}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw response;
        }
      })
      .then(json => {
        var data = utils.parseData(json);

        data = utils.formatData(data, filterString);
        data.results = this.sortData(data, sortOrder);

        console.log('+++ DISCO RESULTS +++');
        // const util = require('util');
        // console.log(util.inspect(data.results, false, null));
        console.log('numMatches: ' + data.results.length);
      
        // add up totals for the sentiment of reviews
        var totals = utils.getTotals(data);

        this.setState({ 
          data: data,
          products: parseProducts(json),
          reviewers: parseReviewers(json),
          entities: parseEntities(json),
          categories: parseCategories(json),
          concepts: parseConcepts(json),
          keywords: parseKeywords(json),
          entityTypes: parseEntityTypes(json),
          loading: false,
          numMatches: data.results.length,
          numPositive: totals.numPositive,
          numNegative: totals.numNegative,
          numNeutral: totals.numNeutral,
          error: null,
          trendData: null,
          sentimentTerm: utils.SENTIMENT_TERM_ITEM,
          trendTerm: utils.TRENDING_TERM_ITEM
        });
        scrollToMain();
      })
      .catch(response => {
        this.setState({
          error: (response.status === 429) ? 'Number of free queries per month exceeded' : 'Error fetching results',
          loading: false,
          data: null
        });
        // eslint-disable-next-line no-console
        console.error(response);
      });
  }
  
  /**
   * buildFilterStringForFacet - build the filter string for
   * one set of filter objects.
   */
  buildFilterStringForFacet(collection, keyName, firstOne) {
    var str = '';
    var firstValue = firstOne; 
    if (collection.size > 0) {
      collection.forEach(function(value) {
        // remove the '(count)' from each entry, if it exists.
        // note - tag cloud items don't have '(count)'s.
        var idx = value.lastIndexOf(' (');
        if (idx >= 0) {
          value = value.substr(0, idx);
        }
        if (firstValue) {
          firstValue = false;
          str = keyName;
        } else {
          str = str + ',' + keyName;
        }
        str = str + '"' + value + '"';
      });
    }
    return str;
  }

  /**
   * buildFilterStringForQuery - convert all selected filters into a string
   * to be added to the search query sent to the discovery service
   */
  buildFilterStringForQuery() {
    var {
      selectedEntities, 
      selectedCategories, 
      selectedConcepts,
      selectedKeywords,
      selectedEntityTypes,
      sentimentFilter,
      productIdFilter,
      reviewerIdFilter
    } = this.state;
    var filterString = '';
    
    // add any entities filters, if selected
    var entitiesString = this.buildFilterStringForFacet(selectedEntities,
      'enriched_text.entities.text::', true);
    filterString = filterString + entitiesString;
      
    // add any category filters, if selected
    var categoryString = this.buildFilterStringForFacet(selectedCategories,
      'enriched_text.categories.label::', filterString === '');
    filterString = filterString + categoryString;

    // add any concept filters, if selected
    var conceptString = this.buildFilterStringForFacet(selectedConcepts,
      'enriched_text.concepts.text::', filterString === '');
    filterString = filterString + conceptString;

    // add any keyword filters, if selected
    var keywordString = this.buildFilterStringForFacet(selectedKeywords,
      'enriched_text.keywords.text::', filterString === '');
    filterString = filterString + keywordString;

    // add any entities type filters, if selected
    var entityTypesString = this.buildFilterStringForFacet(selectedEntityTypes,
      'enriched_text.entities.type::', filterString === '');
    filterString = filterString + entityTypesString;

    // and sentiment filter, if selected
    console.log('sentimentFilter:' + sentimentFilter);
    if (typeof sentimentFilter !== 'undefined' && sentimentFilter.length > 1) {
      if (sentimentFilter !== 'ALL') {
        if (filterString != '') {
          filterString = filterString + ',';
        }
        filterString = filterString + 'enriched_text.sentiment.document.label::' + sentimentFilter;
      }
    }

    // add any product ID filter, if selected
    console.log('productIdFilter:' + productIdFilter);
    if (typeof productIdFilter !== 'undefined' && productIdFilter.length > 1) {
      if (productIdFilter !== 'ALL') {
        if (filterString != '') {
          filterString = filterString + ',';
        }
        filterString = filterString + 'ProductId::' + productIdFilter;
      }
    }
    
    // add any reviewer ID filter, if selected
    console.log('reviewerIdFilter:' + reviewerIdFilter);
    if (typeof reviewerIdFilter !== 'undefined' && reviewerIdFilter.length > 1) {
      if (reviewerIdFilter !== 'ALL') {
        if (filterString != '') {
          filterString = filterString + ',';
        }
        filterString = filterString + 'UserId::' + reviewerIdFilter;
      }
    }
    
    console.log('FilterString: ' + filterString);
    return filterString;
  }

  /**
   * buildFullTagName - this matches the selected tag cloud item with
   * the item in the filter collection. This is needed to keep them in 
   * sync with each other. This takes care of the issue where the tag
   * cloud item is formatted differently than the collection item (the
   * collection item name has a count appended to it).
   */
  buildFullTagName(tag, collection) {
    // find the tag in collection
    for (var i=0; i<collection.length; i++) {
      console.log('compare tag: ' + tag + ' with: ' + collection[i].key);
      if (collection[i].key === tag) {
        // return the full tag so we can match the entries
        // listed in the filters (which also show num of matches)
        return collection[i].key + ' (' + collection[i].matching_results + ')';
      }
    }
    return tag;
  }

  /**
   * getMatches - return collection matches to be rendered.
   */
  getMatches() {
    const { data, currentPage } = this.state;

    if (!data) {
      return null;
    }

    // get one page of matches
    var page = parseInt(currentPage);
    var startIdx = (page - 1) * utils.ITEMS_PER_PAGE;
    var pageOfMatches = data.results.slice(startIdx,startIdx+utils.ITEMS_PER_PAGE);

    return (
      <Matches 
        matches={ pageOfMatches }
      />
    );
  }

  /**
   * getPaginationMenu - return pagination menu to be rendered.
   */
  getPaginationMenu() {
    const { numMatches } = this.state;
    
    if (numMatches > 1) {
      return (
        <div className='matches-pagination-bar'>
          <PaginationMenu
            numMatches={numMatches}
            onPageChange={this.pageChanged.bind(this)}
          />
        </div>
      );
    } else {
      return null;
    }
  }


  getSentimentFilter() {
    const { sentimentFilter } = this.state;
    
    const reviewSentimentOptions = [
      { key: 'ALL', value: 'ALL', text: 'Show All Reviews' },
      { key: 'POS', value: 'positive', text: 'Show Positive Reviews' },
      { key: 'NEG', value: 'negative', text: 'Show Negative Reviews' }
    ];

    return (
      <Dropdown 
        className='top-filter-class'
        defaultValue={ sentimentFilter }
        search
        selection
        scrolling
        options={ reviewSentimentOptions }
        onChange={ this.applySentimentFilter.bind(this) }
      />
    );
  }

  /**
   * getProductFilter - return products filter object to be rendered.
   */
  getProductFilter() {
    const { products, productIdFilter } = this.state;

    var showProductOptions = [
      { key: 'ALL', value: 'ALL', text: 'For All Products' }
    ];

    products.results.forEach(function(entry) {
      showProductOptions.push({
        key: entry.key,
        value: entry.key,
        text: 'For Product: ' + entry.key + ' (' + entry.matching_results + ')'
      });
    });

    return (
      <Dropdown 
        className='top-filter-class'
        defaultValue={ productIdFilter }
        search
        selection
        scrolling
        options={ showProductOptions }
        onChange={ this.applyProductIdFilter.bind(this) }
      />
    );
  }
  
  /**
   * getReviewerFilter - return reviewers filter object to be rendered.
   */
  getReviewerFilter() {
    const { reviewers, reviewerIdFilter } = this.state;
    var showReviewersOptions = [
      { key: 'ALL', value: 'ALL', text: 'For All Reviewers' }
    ];

    reviewers.results.forEach(function(entry) {
      showReviewersOptions.push({
        key: entry.key,
        value: entry.key,
        text: 'For Reviewer: ' + entry.key  + ' (' + entry.matching_results + ')'
      });
    });


    return (
      <Dropdown 
        defaultValue={ reviewerIdFilter }
        search
        selection
        scrolling
        options={ showReviewersOptions }
        onChange={ this.applyReviewerIdFilter.bind(this) }
      />
    );
  }

  /**
   * getEntitiesFilter - return entities filter object to be rendered.
   */
  getEntitiesFilter() {
    const { entities, selectedEntities } = this.state;
    if (!entities) {
      return null;
    }
    return (
      <EntitiesFilter 
        onFilterItemsChange={this.filtersChanged.bind(this)}
        entities={entities.results}
        selectedEntities={selectedEntities}
      />
    );
  }

  /**
   * getCategoriesFilter - return categories filter object to be rendered.
   */
  getCategoriesFilter() {
    const { categories, selectedCategories } = this.state;
    if (!categories) {
      return null;
    }
    return (
      <CategoriesFilter 
        onFilterItemsChange={this.filtersChanged.bind(this)}
        categories={categories.results}
        selectedCategories={selectedCategories}
      />
    );
  }

  /**
   * getConceptsFilter - return concepts filter object to be rendered.
   */
  getConceptsFilter() {
    const { concepts, selectedConcepts } = this.state;
    if (!concepts) {
      return null;
    }
    return (
      <ConceptsFilter 
        onFilterItemsChange={this.filtersChanged.bind(this)}
        concepts={concepts.results}
        selectedConcepts={selectedConcepts}
      />
    );
  }

  /**
   * getKeywordsFilter - return keywords filter object to be rendered.
   */
  getKeywordsFilter() {
    const { keywords, selectedKeywords } = this.state;
    if (!keywords) {
      return null;
    }
    return (
      <KeywordsFilter
        onFilterItemsChange={this.filtersChanged.bind(this)}
        keywords={keywords.results}
        selectedKeywords={selectedKeywords}
      />
    );
  }

  /**
   * getEntityTypeFilter - return entity types filter object to be rendered.
   */
  getEntityTypesFilter() {
    const { entityTypes, selectedEntityTypes } = this.state;
    if (!entityTypes) {
      return null;
    }
    return (
      <EntityTypesFilter
        onFilterItemsChange={this.filtersChanged.bind(this)}
        entityTypes={entityTypes.results}
        selectedEntityTypes={selectedEntityTypes}
      />
    );
  }

  /**
   * render - return all the home page object to be rendered.
   */
  render() {
    const { loading, data, error,
      entities, categories, concepts, keywords, entityTypes,
      selectedEntities, selectedCategories, 
      selectedConcepts,selectedKeywords, selectedEntityTypes,
      numMatches, numPositive, numNeutral, numNegative,
      trendData, trendLoading, trendError, trendTerm,
      sortOrder, sentimentTerm } = this.state;

    // used for filter accordions
    const { activeFilterIndex } = this.state;

    const stat_items = [
      { key: 'matches', label: 'REVIEWS', value: numMatches },
      { key: 'positive', label: 'POSITIVE', value: numPositive },
      { key: 'neutral', label: 'NEUTRAL', value: numNeutral },
      { key: 'negative', label: 'NEGATIVE', value: numNegative }
    ];

    // const util = require('util');
    // console.log("PRODUCTS: ");
    // console.log(util.inspect(products, false, null));
    // console.log("SELECTED SENTIMENTS: ");
    // console.log(util.inspect(selectedSentiments, false, null));
    // console.log('sentimentFilter: ' + sentimentFilter);
    var filtersOn = false;
    if (selectedEntities.size > 0 ||
      selectedCategories.size > 0 ||
      selectedConcepts.size > 0 ||
      selectedKeywords.size > 0 ||
      selectedEntityTypes.size > 0) {
      filtersOn = true;
    }

    return (
      <Grid celled className='search-grid'>

        {/* Search Field Header */}

        <Grid.Row color={'blue'}>
          <Grid.Column width={16} textAlign='center'>
            <Grid className='search-field-grid'>
              <Grid.Column width={16} verticalAlign='middle' textAlign='center'>
                <Header as='h1' textAlign='center'>
                  Food Review Data
                </Header>
              </Grid.Column>
            </Grid>
          </Grid.Column>
        </Grid.Row>

        <Grid.Row color={'teal'}>
          <Grid.Column width={16} textAlign='center'>
            { this.getSentimentFilter() }
            { this.getProductFilter() }
            { this.getReviewerFilter() }
          </Grid.Column>
        </Grid.Row>

        {/* Results Panel */}

        <Grid.Row className='matches-grid-row'>

          {/* Drop-Down Filters */}

          <Grid.Column width={3}>

            <Header as='h2' block inverted textAlign='left'>
              <Icon name='filter' />
              <Header.Content>
                Filter
                <Header.Subheader>
                  By Enrichments
                </Header.Subheader>
              </Header.Content>
            </Header>

            {filtersOn ? (
              <Button
                compact
                size='tiny'
                fluid
                basic
                color='red'
                content='clear all'
                icon='remove'
                onClick={this.handleClearAllFiltersClick.bind(this)}
              />
            ) : null}

            <Accordion styled>
              <Accordion.Title 
                active={activeFilterIndex == utils.ENTITY_DATA_INDEX}
                index={utils.ENTITY_DATA_INDEX}
                onClick={this.handleAccordionClick.bind(this)}>
                <Icon name='dropdown' />
                Entities
              </Accordion.Title>
              <Accordion.Content active={activeFilterIndex == utils.ENTITY_DATA_INDEX}>
                {this.getEntitiesFilter()}
              </Accordion.Content>
            </Accordion>
            <Accordion styled>
              <Accordion.Title 
                active={activeFilterIndex == utils.CATEGORY_DATA_INDEX}
                index={utils.CATEGORY_DATA_INDEX}
                onClick={this.handleAccordionClick.bind(this)}>
                <Icon name='dropdown' />
                Categories
              </Accordion.Title>
              <Accordion.Content active={activeFilterIndex == utils.CATEGORY_DATA_INDEX}>
                {this.getCategoriesFilter()}
              </Accordion.Content>
            </Accordion>
            <Accordion styled>
              <Accordion.Title 
                active={activeFilterIndex == utils.CONCEPT_DATA_INDEX}
                index={utils.CONCEPT_DATA_INDEX}
                onClick={this.handleAccordionClick.bind(this)}>
                <Icon name='dropdown' />
                Concepts
              </Accordion.Title>
              <Accordion.Content active={activeFilterIndex == utils.CONCEPT_DATA_INDEX}>
                {this.getConceptsFilter()}
              </Accordion.Content>
            </Accordion>
            <Accordion styled>
              <Accordion.Title
                active={activeFilterIndex == utils.KEYWORD_DATA_INDEX}
                index={utils.KEYWORD_DATA_INDEX}
                onClick={this.handleAccordionClick.bind(this)}>
                <Icon name='dropdown' />
                Keywords
              </Accordion.Title>
              <Accordion.Content active={activeFilterIndex == utils.KEYWORD_DATA_INDEX}>
                {this.getKeywordsFilter()}
              </Accordion.Content>
            </Accordion>
            <Accordion styled>
              <Accordion.Title
                active={activeFilterIndex == utils.ENTITY_TYPE_DATA_INDEX}
                index={utils.ENTITY_TYPE_DATA_INDEX}
                onClick={this.handleAccordionClick.bind(this)}>
                <Icon name='dropdown' />
                Entity Types
              </Accordion.Title>
              <Accordion.Content active={activeFilterIndex == utils.ENTITY_TYPE_DATA_INDEX}>
                {this.getEntityTypesFilter()}
              </Accordion.Content>
            </Accordion>
            
          </Grid.Column>

          {/* Results */}

          <Grid.Column width={7}>
            <Grid.Row>
              {loading ? (
                <div className="results">
                  <div className="loader--container">
                    <Dimmer active inverted>
                      <Loader>Loading</Loader>
                    </Dimmer>
                  </div>
                </div>
              ) : data ? (
                <div className="results">
                  <div className="_container _container_large">
                    <div className="row">
                      <div>
                        <Header as='h2' block inverted textAlign='left'>
                          <Icon name='grid layout' />
                          <Header.Content>
                            Matches
                          </Header.Content>
                        </Header>
                        <Statistic.Group
                          size='mini'
                          items={ stat_items }
                        />
                        <Menu compact className="sort-dropdown">
                          <Icon name='sort' size='large' bordered inverted />
                          <Dropdown 
                            item
                            onChange={ this.sortOrderChange.bind(this) }
                            value={ sortOrder }
                            options={ utils.sortTypes }
                          />
                        </Menu>
                      </div>
                      <div>
                        {this.getMatches()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : error ? (
                <div className="results">
                  <div className="_container _container_large">
                    <div className="row">
                      {JSON.stringify(error)}
                    </div>
                  </div>
                </div>
              ) : null}
            </Grid.Row>
            <Divider clearing hidden/>

            {/* Pagination Menu */}

            <Grid.Row>
              {this.getPaginationMenu()}
            </Grid.Row>
          </Grid.Column>

          <Grid.Column width={6}>

            {/* Sentiment Chart Region */}

            <Grid.Row className='rrr'>
              <SentimentChart
                entities={entities}
                categories={categories}
                concepts={concepts}
                keywords={keywords}
                entityTypes={entityTypes}
                term={sentimentTerm}
                onSentimentTermChanged={this.sentimentTermChanged.bind(this)}
              />
            </Grid.Row>

            <Divider hidden/>
            <Divider/>
            <Divider hidden/>

            {/* Trend Chart Region */}

            <Grid.Row className='ttt'>
              <div className="trend-chart">
                <TrendChart
                  trendData={trendData}
                  trendLoading={trendLoading}
                  trendError={trendError}
                  entities={entities}
                  categories={categories}
                  concepts={concepts}
                  keywords={keywords}
                  entityTypes={entityTypes}
                  term={trendTerm}
                  onGetTrendDataRequest={this.getTrendData.bind(this)}
                />
              </div>
            </Grid.Row>

          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

/**
 * parseProducts - convert raw search results into collection of product IDs.
 */
const parseProducts = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.PRODUCT_DATA_INDEX].results
});

/**
 * parseReviewers - convert raw search results into collection of reviewers.
 */
const parseReviewers = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.REVIEWER_DATA_INDEX].results
});

/**
 * parseEntities - convert raw search results into collection of entities.
 */
const parseEntities = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.ENTITY_DATA_INDEX].results
});

/**
 * parseCategories - convert raw search results into collection of categories.
 */
const parseCategories = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.CATEGORY_DATA_INDEX].results
});

/**
 * parseConcepts - convert raw search results into collection of concepts.
 */
const parseConcepts = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.CONCEPT_DATA_INDEX].results
});

/**
 * parseKeywords - convert raw search results into collection of keywords.
 */
const parseKeywords = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.KEYWORD_DATA_INDEX].results
});

/**
 * parseEntityTypes - convert raw search results into collection of entity types.
 */
const parseEntityTypes = data => ({
  rawResponse: Object.assign({}, data),
  results: data.aggregations[utils.ENTITY_TYPE_DATA_INDEX].results
});

/**
 * scrollToMain - scroll window to show 'main' rendered object.
 */
function scrollToMain() {
  setTimeout(() => {
    const scrollY = document.querySelector('main').getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, scrollY);
  }, 0);
}

// type check to ensure we are called correctly
Main.propTypes = {
  data: PropTypes.object,
  sentiments: PropTypes.object,
  properties: PropTypes.object,
  products: PropTypes.object,
  reviewers: PropTypes.object,
  entities: PropTypes.object,
  categories: PropTypes.object,
  concepts: PropTypes.object,
  keywords: PropTypes.object,
  entityTypes: PropTypes.object,
  searchQuery: PropTypes.string,
  selectedSentiments: PropTypes.object,
  selectedProperties: PropTypes.object,
  selectedReviewers: PropTypes.object,
  selectedEntities: PropTypes.object,
  selectedCategories: PropTypes.object,
  selectedConcepts: PropTypes.object,
  selectedKeywords: PropTypes.object,
  selectedEntityTypes: PropTypes.object,
  numMatches: PropTypes.number,
  numPositive: PropTypes.number,
  numNeutral: PropTypes.number,
  numNegative: PropTypes.number,
  currentPage: PropTypes.string,
  sortOrder: PropTypes.string,
  sentimentFilter: PropTypes.string,
  productIdFilter: PropTypes.string,
  reviewerIdFilter: PropTypes.string,
  trendData: PropTypes.object,
  trendError: PropTypes.object,
  trendTerm: PropTypes.string,
  sentimentTerm: PropTypes.string,
  error: PropTypes.object
};

module.exports = Main;
